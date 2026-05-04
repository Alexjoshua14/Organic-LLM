"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import type { BlockNoteEditor } from "@blocknote/core";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { Save, X } from "lucide-react";

import { STRATA_NOTEPAD_FRAGMENT, useStrataNotepad } from "./use-strata-notepad";

import { cn } from "@/lib/utils";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";

/**
 * Strata notepad surface — a Notion-style BlockNote editor bound to a Yjs doc.
 *
 * Persistence layering (single source of truth: see `use-strata-notepad`):
 *   - Keystroke -> Yjs (sync)
 *   - Per Yjs update -> y-indexeddb (undebounced)
 *   - 500ms idle / Save now / unmount -> Supabase POST (binary diff)
 *
 * The component never persists markdown directly. It emits `onMarkdownChange` so the parent can
 * keep the legacy `StrataTextSourceNode.body` (used for chat corpus grounding) in sync, but the
 * Yjs doc remains the source of truth for editor content.
 */
export type StrataNotepadProps = {
  pageId: string;
  noteId: string;
  /**
   * Plain-text title for the active note. Controlled by the parent so saved-source list cards stay
   * in sync without round-tripping through the Yjs doc.
   */
  title: string;
  onTitleChange: (title: string) => void;
  /**
   * Legacy markdown body to seed the Yjs doc from on first edit. Only used when the server has no
   * snapshot for this note yet AND the doc looks empty after IDB hydration. Subsequent edits live
   * in the Yjs doc and are saved as binary diffs.
   */
  initialMarkdown?: string;
  /** Debounced markdown derivation; parent uses it to keep the chat-corpus body fresh. */
  onMarkdownChange?: (markdown: string) => void;
  /** Fires once after first hydration so the parent can flip a note from text-only to richKind. */
  onUpgradedToRich?: () => void;
  /**
   * After markdown + Yjs are flushed to the parent and server, run to persist the page and clear
   * the active note so the user can pick another or start fresh.
   */
  onCloseNote?: () => void | Promise<void>;
  className?: string;
};

const TITLE_MAX_LENGTH = 512;

const MARKDOWN_DEBOUNCE_MS = 800;

export function StrataNotepad({
  pageId,
  noteId,
  title,
  onTitleChange,
  initialMarkdown,
  onMarkdownChange,
  onUpgradedToRich,
  onCloseNote,
  className,
}: StrataNotepadProps) {
  const { resolvedTheme } = useTheme();
  const { doc, ready, flushToServer, markServerSeen, clientId } = useStrataNotepad({
    pageId,
    noteId,
  });

  const fragment = useMemo(() => doc.getXmlFragment(STRATA_NOTEPAD_FRAGMENT), [doc]);

  /**
   * Recreate the editor whenever the Yjs doc instance changes (i.e. when the active note swaps).
   * BlockNote binds to the fragment via `collaboration` and keeps the editor state in lockstep
   * with Yjs from then on.
   */
  const editor = useCreateBlockNote(
    {
      collaboration: {
        fragment,
        user: { name: "You", color: "#3b82f6" },
      },
    },
    [doc]
  ) as BlockNoteEditor;

  const [wordCount, setWordCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const seededRef = useRef(false);
  const markdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    seededRef.current = false;
  }, [pageId, noteId]);

  useEffect(() => {
    if (!ready || seededRef.current) return;
    seededRef.current = true;

    const docEmpty = fragment.length === 0;
    const seed = initialMarkdown?.trim() ?? "";

    if (docEmpty && seed.length > 0) {
      try {
        const blocks = editor.tryParseMarkdownToBlocks(sanitizeRawUserInput(seed));

        if (blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
          markServerSeen();
          onUpgradedToRich?.();
          void flushToServer();
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[strata-notepad] markdown seed failed", err);
        }
      }
    }
  }, [editor, flushToServer, fragment, initialMarkdown, markServerSeen, onUpgradedToRich, ready]);

  useEffect(() => {
    if (!ready) return undefined;

    const compute = () => {
      const blocks = editor.document;
      const md = editor.blocksToMarkdownLossy(blocks);
      const words = md.trim().length === 0 ? 0 : md.trim().split(/\s+/u).length;

      setWordCount(words);

      if (markdownTimerRef.current) clearTimeout(markdownTimerRef.current);
      if (onMarkdownChange) {
        markdownTimerRef.current = setTimeout(() => {
          markdownTimerRef.current = null;
          onMarkdownChange(md);
        }, MARKDOWN_DEBOUNCE_MS);
      }
    };

    const dispose = editor.onChange(compute);

    compute();

    return () => {
      if (markdownTimerRef.current) {
        clearTimeout(markdownTimerRef.current);
        markdownTimerRef.current = null;
      }
      dispose?.();
    };
  }, [editor, onMarkdownChange, ready]);

  const handleSaveNow = useCallback(async () => {
    setSaving(true);
    try {
      await flushToServer();
      setLastSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [flushToServer]);

  const flushMarkdownToParentNow = useCallback(() => {
    if (markdownTimerRef.current) {
      clearTimeout(markdownTimerRef.current);
      markdownTimerRef.current = null;
    }
    if (!onMarkdownChange || !ready) return;
    const md = editor.blocksToMarkdownLossy(editor.document);

    onMarkdownChange(sanitizeRawUserInput(md));
  }, [editor, onMarkdownChange, ready]);

  const handleCloseNote = useCallback(async () => {
    if (!onCloseNote) return;
    setSaving(true);
    try {
      flushMarkdownToParentNow();
      await flushToServer();
      await Promise.resolve(onCloseNote());
      setLastSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }, [flushMarkdownToParentNow, flushToServer, onCloseNote]);

  const lastSavedLabel = useMemo(() => {
    if (saving) return "Saving…";
    if (lastSavedAt === null) return "Synced via local cache";
    const seconds = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));

    return `Saved ${seconds}s ago`;
  }, [lastSavedAt, saving]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-2.5 overflow-hidden text-foreground",
        className
      )}
      data-strata-notepad
      data-client-id={clientId}
    >
      <div className="flex shrink-0 items-start gap-3">
        <input
          aria-label="Note title"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Untitled note"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={saving || !ready}
            onClick={() => void handleSaveNow()}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors",
              "hover:border-border/40 hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
            )}
            title="Save now"
            aria-label="Save now"
          >
            <Save className="size-3.5" aria-hidden />
            Save
          </button>
          {onCloseNote ? (
            <button
              type="button"
              disabled={saving || !ready}
              onClick={() => void handleCloseNote()}
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
                "hover:border-border/40 hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
              )}
              title="Close note — save to sources and clear"
              aria-label="Close note"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "strata-notepad-editor flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-2",
          "[&_.bn-root]:[--bn-colors-editor-background:transparent]",
          "[&_.bn-root]:[--bn-colors-editor-text:var(--foreground)]",
          "[&_.bn-editor]:rounded-none [&_.bn-editor]:bg-transparent [&_.bn-editor]:shadow-none",
          "[&_.bn-editor]:!pl-6 [&_.bn-editor]:!pr-4 sm:[&_.bn-editor]:!pl-8 sm:[&_.bn-editor]:!pr-5"
        )}
      >
        <BlockNoteView
          editor={editor}
          editable
          theme={resolvedTheme === "dark" ? "dark" : "light"}
        />
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border/10 pt-2 text-xs text-muted-foreground">
        <span>{wordCount.toLocaleString()} words</span>
        <span>{lastSavedLabel}</span>
      </div>
    </div>
  );
}

export default StrataNotepad;
