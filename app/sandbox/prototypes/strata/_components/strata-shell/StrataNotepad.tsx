"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";

import type { BlockNoteEditor } from "@blocknote/core";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { Save } from "lucide-react";

import { STRATA_NOTEPAD_FRAGMENT, useStrataNotepad } from "./use-strata-notepad";

import { glass } from "@/components/design-system/primitives";
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

  const lastSavedLabel = useMemo(() => {
    if (saving) return "Saving…";
    if (lastSavedAt === null) return "Synced via local cache";
    const seconds = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));

    return `Saved ${seconds}s ago`;
  }, [lastSavedAt, saving]);

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border/60 p-4",
        className
      )}
      data-strata-notepad
      data-client-id={clientId}
    >
      <div className="flex items-start gap-3">
        <input
          aria-label="Note title"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Untitled note"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <button
          type="button"
          disabled={saving || !ready}
          onClick={() => void handleSaveNow()}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground disabled:opacity-50"
          )}
          title="Save now"
          aria-label="Save now"
        >
          <Save className="size-3.5" aria-hidden />
          Save
        </button>
      </div>

      <div className="strata-notepad-editor flex-1 min-h-0 overflow-y-auto rounded-md border border-border/40 bg-background/30">
        <BlockNoteView
          editor={editor}
          editable
          theme={resolvedTheme === "dark" ? "dark" : "light"}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount.toLocaleString()} words</span>
        <span>{lastSavedLabel}</span>
      </div>
    </div>
  );
}

export default StrataNotepad;
