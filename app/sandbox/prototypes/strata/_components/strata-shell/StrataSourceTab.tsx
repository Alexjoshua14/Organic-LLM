"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { StrataPageWithSections } from "@/lib/schemas/strata";
import type { StrataPageAssistantSession } from "@/lib/strata/assistant-session";
import type { SourceDocLayout } from "./strata-shell-model";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpenText, Columns2, Plus, SquarePen } from "lucide-react";
import { motion } from "framer-motion";

import { StrataSourceComposerOptions } from "./StrataSourceComposerOptions";
import { StrataSourceInput, type StrataSourceInputMode } from "./StrataSourceInput";
import { StrataTextSourcesList } from "./StrataTextSourcesList";
import { StrataNotepad } from "./StrataNotepad";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/third-party/ui/context-menu";
import { glass } from "@/components/design-system/primitives";
import { clientRandomUUID } from "@/lib/client-uuid";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import {
  buildCorpusFromTextSources,
  parseTextSourcesFromContentJson,
  setTextSourcesInContentJson,
} from "@/lib/strata/text-sources";
import { cn } from "@/lib/utils";
import { STRATA_TEXT_SOURCES_MAX, type StrataTextSourceNode } from "@/lib/schemas/strata";
import {
  inferBlocksFromBody,
  parseNotepadBlocksByNoteId,
  setNotepadBlocksInContentJson,
  type StrataNotepadBlock,
} from "@/lib/strata/notepad-blocks";

const NOTEPAD_DEFAULT_TITLE = "Untitled note";

function isBlankUserTextNote(n: StrataTextSourceNode): boolean {
  if (n.kind !== "user_text") return false;
  const title = n.title?.trim() ?? "";

  return n.body.trim().length === 0 && (title.length === 0 || title === NOTEPAD_DEFAULT_TITLE);
}

export function StrataSourceTab({
  sourceDocLayout,
  setSourceDocLayout,
  reduceMotion,
  sections,
  setSections,
  refinedSectionTitle,
  queueRawAutosave,
  flushSaveRaw,
  rawSyncFooter,
  statusRow,
  pageId,
  dbAvailable,
  localOnlyMode,
  assistantSession,
}: {
  sourceDocLayout: SourceDocLayout;
  setSourceDocLayout: (layout: SourceDocLayout) => void;
  reduceMotion: boolean | null;
  sections: StrataPageWithSections["sections"];
  setSections: Dispatch<SetStateAction<StrataPageWithSections["sections"]>>;
  refinedSectionTitle: string;
  queueRawAutosave: () => void;
  flushSaveRaw: () => Promise<void>;
  rawSyncFooter: { busy: boolean; label: string };
  statusRow: ReactNode;
  pageId: string;
  dbAvailable: boolean;
  localOnlyMode: boolean;
  assistantSession?: StrataPageAssistantSession;
}) {
  const textSources = useMemo(
    () =>
      parseTextSourcesFromContentJson(
        sections.raw_text.contentJson as Record<string, unknown> | null
      ),
    [sections.raw_text.contentJson]
  );

  const ingestEnabled = dbAvailable && !localOnlyMode && !pageId.startsWith("local-");
  /**
   * The notepad persists through `sections.raw_text` (sources JSON + flattened corpus).
   * Ingest tooling (web, URL, files, Flipboard paste) requires a synced Strata UUID.
   */
  const notepadEnabled = ingestEnabled;

  const userTextNotes = useMemo(
    () => textSources.filter((s) => s.kind === "user_text"),
    [textSources]
  );
  const notepadBlocksByNoteId = useMemo(
    () =>
      parseNotepadBlocksByNoteId(
        sections.raw_text.contentJson as Record<string, unknown> | null | undefined
      ),
    [sections.raw_text.contentJson]
  );

  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash;
    const match = hash.match(/note=([0-9a-f-]+)/i);

    return match?.[1] ?? null;
  });

  const [sourceInputMode, setSourceInputMode] = useState<StrataSourceInputMode>("note");

  const applySources = useCallback(
    (next: StrataTextSourceNode[]) => {
      setSections((prev) => {
        const baseContentJson = setTextSourcesInContentJson(
          prev.raw_text.contentJson as Record<string, unknown> | null,
          next
        );
        const blockMap = parseNotepadBlocksByNoteId(
          prev.raw_text.contentJson as Record<string, unknown> | null
        );
        const allowedIds = new Set(
          next.filter((node) => node.kind === "user_text").map((node) => node.id)
        );
        const prunedMap = Object.fromEntries(
          Object.entries(blockMap).filter(([id]) => allowedIds.has(id))
        );
        const contentJson = setNotepadBlocksInContentJson(baseContentJson, prunedMap);
        const corpus = buildCorpusFromTextSources(next);

        return {
          ...prev,
          raw_text: {
            ...prev.raw_text,
            content: sanitizeRawUserInput(corpus),
            contentJson,
          },
        };
      });
      queueRawAutosave();
    },
    [queueRawAutosave, setSections]
  );

  const onAppendNodes = useCallback(
    (nodes: StrataTextSourceNode[]) => {
      if (nodes.length === 0) return;
      setSections((prev) => {
        let existing = parseTextSourcesFromContentJson(
          prev.raw_text.contentJson as Record<string, unknown> | null
        );

        if (existing.length === 0 && prev.raw_text.content.trim().length > 0) {
          existing = [
            {
              id: clientRandomUUID(),
              kind: "user_text",
              title: "Existing raw text",
              body: sanitizeRawUserInput(prev.raw_text.content),
              createdAt: new Date().toISOString(),
            },
          ];
        }
        const merged = [...existing, ...nodes].slice(0, STRATA_TEXT_SOURCES_MAX);
        const contentJson = setTextSourcesInContentJson(
          prev.raw_text.contentJson as Record<string, unknown> | null,
          merged
        );
        const corpus = buildCorpusFromTextSources(merged);

        return {
          ...prev,
          raw_text: {
            ...prev.raw_text,
            content: sanitizeRawUserInput(corpus),
            contentJson,
          },
        };
      });
      queueRawAutosave();
    },
    [queueRawAutosave, setSections]
  );

  const onRemoveSource = useCallback(
    (id: string) => {
      const next = textSources.filter((s) => s.id !== id);

      applySources(next);
      if (id === activeNoteId) setActiveNoteId(null);
    },
    [activeNoteId, applySources, textSources]
  );

  const onMoveSource = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = textSources.findIndex((s) => s.id === id);
      const j = idx + dir;

      if (idx < 0 || j < 0 || j >= textSources.length) return;
      const next = [...textSources];

      [next[idx], next[j]] = [next[j]!, next[idx]!];
      applySources(next);
    },
    [applySources, textSources]
  );

  const onUpdateSource = useCallback(
    (id: string, patch: { title: string; body: string }) => {
      const next = textSources.map((s) =>
        s.id === id ? { ...s, title: patch.title, body: patch.body } : s
      );

      applySources(next);
    },
    [applySources, textSources]
  );

  /** Ensures there is exactly one active user_text note to drive the notepad. */
  const ensureActiveNote = useCallback((): string | null => {
    const userNotes = textSources.filter((s) => s.kind === "user_text");

    if (userNotes.length === 0) {
      const id = clientRandomUUID();
      const node: StrataTextSourceNode = {
        id,
        kind: "user_text",
        title: NOTEPAD_DEFAULT_TITLE,
        body: "",
        createdAt: new Date().toISOString(),
      };

      onAppendNodes([node]);
      setActiveNoteId(id);

      return id;
    }
    if (activeNoteId && userNotes.some((n) => n.id === activeNoteId)) return activeNoteId;
    const fallback = userNotes[userNotes.length - 1]!.id;

    setActiveNoteId(fallback);

    return fallback;
  }, [activeNoteId, onAppendNodes, textSources]);

  const ensureActiveNoteRef = useRef(ensureActiveNote);

  ensureActiveNoteRef.current = ensureActiveNote;

  /** When true, the next auto-select effect run is skipped (user explicitly closed the notepad). */
  const skipNextAutoNoteRef = useRef(false);

  useEffect(() => {
    if (!notepadEnabled) return;
    if (activeNoteId && userTextNotes.some((n) => n.id === activeNoteId)) return;
    if (skipNextAutoNoteRef.current) {
      skipNextAutoNoteRef.current = false;

      return;
    }
    if (userTextNotes.length === 0) {
      ensureActiveNoteRef.current();
    } else {
      setActiveNoteId(userTextNotes[userTextNotes.length - 1]!.id);
    }
  }, [activeNoteId, notepadEnabled, userTextNotes]);

  const activeNote = useMemo(
    () => textSources.find((n) => n.id === activeNoteId) ?? null,
    [activeNoteId, textSources]
  );
  const activeNoteBlocks = useMemo(() => {
    if (!activeNoteId) return [];
    const existing = notepadBlocksByNoteId[activeNoteId];

    if (existing) return existing;

    return inferBlocksFromBody(activeNote?.body ?? "");
  }, [activeNote?.body, activeNoteId, notepadBlocksByNoteId]);

  const handleNotepadTitleChange = useCallback(
    (title: string) => {
      if (!activeNote) return;
      onUpdateSource(activeNote.id, { title, body: activeNote.body });
    },
    [activeNote, onUpdateSource]
  );

  const handleNotepadBodyChange = useCallback(
    (markdown: string) => {
      if (!activeNote) return;
      const sanitized = sanitizeRawUserInput(markdown);

      onUpdateSource(activeNote.id, {
        title: activeNote.title,
        body: sanitized,
      });
    },
    [activeNote, onUpdateSource]
  );
  const handleNotepadBlocksChange = useCallback(
    (noteId: string, blocks: StrataNotepadBlock[]) => {
      setSections((prev) => {
        const currentJson = prev.raw_text.contentJson as Record<string, unknown> | null;
        const nextMap = {
          ...parseNotepadBlocksByNoteId(currentJson),
          [noteId]: blocks,
        };
        const nextJson = setNotepadBlocksInContentJson(currentJson, nextMap);

        return {
          ...prev,
          raw_text: {
            ...prev.raw_text,
            contentJson: nextJson,
          },
        };
      });
      queueRawAutosave();
    },
    [queueRawAutosave, setSections]
  );

  const handleNewNote = useCallback(() => {
    const existingBlank = userTextNotes.find(isBlankUserTextNote);

    if (existingBlank) {
      setActiveNoteId(existingBlank.id);
      setSourceInputMode("note");

      return;
    }

    const id = clientRandomUUID();
    const node: StrataTextSourceNode = {
      id,
      kind: "user_text",
      title: NOTEPAD_DEFAULT_TITLE,
      body: "",
      createdAt: new Date().toISOString(),
    };

    onAppendNodes([node]);
    setActiveNoteId(id);
    setSourceInputMode("note");
  }, [onAppendNodes, userTextNotes]);

  const handleCloseNotepad = useCallback(() => {
    skipNextAutoNoteRef.current = true;
    queueMicrotask(() => {
      void flushSaveRaw().finally(() => {
        setActiveNoteId(null);
      });
    });
  }, [flushSaveRaw]);

  const handleClipboardPasteToNotepad = useCallback(
    (text: string, suggestedTitle: string) => {
      if (!activeNote) {
        const id = clientRandomUUID();
        const node: StrataTextSourceNode = {
          id,
          kind: "user_text",
          title: suggestedTitle.slice(0, 512) || NOTEPAD_DEFAULT_TITLE,
          body: sanitizeRawUserInput(text),
          createdAt: new Date().toISOString(),
        };

        onAppendNodes([node]);
        setActiveNoteId(id);

        return;
      }
      const merged =
        activeNote.body.trim().length > 0 ? `${activeNote.body.trimEnd()}\n\n${text}` : text;
      const isUntitled = !activeNote.title || activeNote.title === NOTEPAD_DEFAULT_TITLE;

      onUpdateSource(activeNote.id, {
        title: isUntitled ? suggestedTitle.slice(0, 512) : activeNote.title,
        body: sanitizeRawUserInput(merged),
      });
    },
    [activeNote, onAppendNodes, onUpdateSource]
  );

  const handleActivateUserText = useCallback((id: string) => {
    setActiveNoteId(id);
    setSourceInputMode("note");
  }, []);

  useEffect(() => {
    if (!notepadEnabled && sourceInputMode === "note") {
      setSourceInputMode("web");
    }
  }, [notepadEnabled, sourceInputMode]);

  const ingesting = sourceInputMode === "web" || sourceInputMode === "url";

  /** Esc closes the spotlight when an ingest sub-panel is open. */
  useEffect(() => {
    if (!ingesting) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSourceInputMode(notepadEnabled ? "note" : "web");
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [ingesting, notepadEnabled]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3"
      data-spotlight={ingesting ? sourceInputMode : "none"}
    >
      <div className="flex min-w-0 w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-start">{statusRow}</div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className={cn(
              glass({ opaque: true }),
              "h-10 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
            )}
            type="button"
            onClick={() => void flushSaveRaw()}
          >
            Save now
          </button>
          <div className="shrink-0 rounded-full bg-background/85 py-0.5 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <motion.button
                  className={cn(
                    glass({ opaque: true }),
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                    "text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    sourceDocLayout !== "raw" && "border-primary/40 bg-muted/30"
                  )}
                  title={
                    sourceDocLayout === "split"
                      ? "Split view — click to return to raw, or right-click for layout options"
                      : sourceDocLayout === "raw"
                        ? "Showing raw — click for refined, right-click for split"
                        : "Showing refined — click for raw, right-click for layout options"
                  }
                  type="button"
                  aria-label={
                    sourceDocLayout === "split"
                      ? "Split view: raw and refined. Activate to return to raw source only."
                      : sourceDocLayout === "raw"
                        ? "Raw source active. Activate to show refined only."
                        : "Refined view active. Activate to show raw source."
                  }
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                  onClick={() => {
                    if (sourceDocLayout === "split") {
                      setSourceDocLayout("raw");
                    } else if (sourceDocLayout === "raw") {
                      setSourceDocLayout("refined");
                    } else {
                      setSourceDocLayout("raw");
                    }
                  }}
                >
                  <motion.span
                    className="inline-flex items-center justify-center"
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.15 }}
                  >
                    {sourceDocLayout === "raw" ? (
                      <SquarePen aria-hidden className="h-4 w-4" />
                    ) : sourceDocLayout === "refined" ? (
                      <BookOpenText aria-hidden className="h-4 w-4" />
                    ) : (
                      <Columns2 aria-hidden className="h-4 w-4" />
                    )}
                  </motion.span>
                </motion.button>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[10rem]">
                <ContextMenuItem onSelect={() => setSourceDocLayout("split")}>
                  <Columns2 className="h-4 w-4" />
                  Split view
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => setSourceDocLayout("raw")}>
                  <SquarePen className="h-4 w-4" />
                  Raw only
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => setSourceDocLayout("refined")}>
                  <BookOpenText className="h-4 w-4" />
                  Refined only
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          ingesting && "opacity-40 blur-[1px] pointer-events-none"
        )}
        inert={ingesting ? true : undefined}
      >
        {assistantSession ? (
          <StrataSourceComposerOptions
            assistantSession={assistantSession}
            collapsibleAssistantTools
            assistantToolsDefaultOpen
          />
        ) : null}
      </div>
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 auto-rows-[minmax(12rem,1fr)]",
          sourceDocLayout === "split" ? "lg:grid-cols-2 lg:items-stretch" : "grid-cols-1"
        )}
      >
        {sourceDocLayout !== "refined" ? (
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3">
            <StrataSourceInput
              className="min-h-0 flex-1"
              mode={sourceInputMode}
              onModeChange={setSourceInputMode}
              notepadEnabled={notepadEnabled}
              activeNoteId={activeNoteId}
              ingestEnabled={ingestEnabled}
              pageId={pageId}
              reduceMotion={reduceMotion}
              ingesting={ingesting}
              onAppendNodes={onAppendNodes}
              onClipboardPasteToNotepad={handleClipboardPasteToNotepad}
              notepad={
                notepadEnabled && activeNoteId ? (
                  <StrataNotepad
                    key={activeNoteId}
                    noteId={activeNoteId}
                    pageId={pageId}
                    body={activeNote?.body ?? ""}
                    onBodyChange={handleNotepadBodyChange}
                    blocks={activeNoteBlocks}
                    onBlocksChange={(blocks) => handleNotepadBlocksChange(activeNoteId, blocks)}
                    onAppendNodes={onAppendNodes}
                    onFlushPersist={flushSaveRaw}
                    onCloseNote={handleCloseNotepad}
                    syncFooter={rawSyncFooter}
                    title={activeNote?.title ?? NOTEPAD_DEFAULT_TITLE}
                    onTitleChange={handleNotepadTitleChange}
                    reduceMotion={reduceMotion}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Create or select a note from the saved sources list below.
                  </p>
                )
              }
            />
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain transition-all duration-200 ease-out",
                ingesting && "opacity-40 blur-[1px] pointer-events-none"
              )}
              inert={ingesting ? true : undefined}
            >
              <div className="flex shrink-0 items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Saved sources
                </p>
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3.5" aria-hidden />
                  New note
                </button>
              </div>
              <div className="min-h-0 min-w-0 pr-1">
                <StrataTextSourcesList
                  activeNoteId={activeNoteId}
                  sources={textSources}
                  onActivateUserText={handleActivateUserText}
                  onMove={onMoveSource}
                  onRemove={onRemoveSource}
                  onUpdateSource={onUpdateSource}
                />
              </div>
            </div>
          </div>
        ) : null}
        {sourceDocLayout !== "raw" ? (
          <div
            className={cn(
              glass({ opaque: true }),
              "flex min-h-0 flex-col rounded-lg border border-border/60 p-5",
              ingesting && "opacity-40 blur-[1px] pointer-events-none transition-all"
            )}
            inert={ingesting ? true : undefined}
          >
            <p className="mb-3 shrink-0 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {refinedSectionTitle}
            </p>
            <div className="prose prose-neutral min-h-0 max-w-none text-[15px] leading-7 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {sections.refined_text.content ||
                  "_No refined preview yet. Use **Generate** in Synthesis after saving source._"}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
