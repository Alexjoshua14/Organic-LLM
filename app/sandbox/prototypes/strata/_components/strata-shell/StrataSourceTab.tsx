"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpenText, Columns2, SquarePen } from "lucide-react";
import { motion } from "framer-motion";

import type { StrataPageAssistantSession } from "@/lib/strata/assistant-session";
import { StrataSourceComposerOptions } from "./StrataSourceComposerOptions";
import { StrataSourceIngestBar } from "./StrataSourceIngestBar";
import { StrataTextSourcesList } from "./StrataTextSourcesList";
import { NOTEBOOK_FOCUS_CLASS, type SourceDocLayout } from "./strata-shell-model";

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

export function StrataSourceTab({
  sourceDocLayout,
  setSourceDocLayout,
  reduceMotion,
  sections,
  setSections,
  refinedSectionTitle,
  queueRawAutosave,
  flushSaveRaw,
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
  flushSaveRaw: () => void;
  statusRow: ReactNode;
  pageId: string;
  dbAvailable: boolean;
  localOnlyMode: boolean;
  assistantSession?: StrataPageAssistantSession;
}) {
  const textSources = useMemo(
    () => parseTextSourcesFromContentJson(sections.raw_text.contentJson as Record<string, unknown> | null),
    [sections.raw_text.contentJson]
  );

  const hasStructuredSources = textSources.length > 0;
  const ingestEnabled = dbAvailable && !localOnlyMode && !pageId.startsWith("local-");

  const applySources = useCallback(
    (next: StrataTextSourceNode[]) => {
      setSections((prev) => {
        const contentJson = setTextSourcesInContentJson(
          prev.raw_text.contentJson as Record<string, unknown> | null,
          next
        );
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
    },
    [applySources, textSources]
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-start">{statusRow}</div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className={cn(
              glass({ opaque: true }),
              "h-10 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
            )}
            type="button"
            onClick={flushSaveRaw}
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
          "grid min-h-0 flex-1 gap-3 auto-rows-[minmax(12rem,1fr)]",
          sourceDocLayout === "split" ? "lg:grid-cols-2 lg:items-stretch" : "grid-cols-1"
        )}
      >
        {sourceDocLayout !== "refined" ? (
          <div className="flex min-h-0 flex-col gap-3">
            <StrataTextSourcesList
              sources={textSources}
              onMove={onMoveSource}
              onRemove={onRemoveSource}
            />
            {assistantSession ? <StrataSourceComposerOptions assistantSession={assistantSession} /> : null}
            <StrataSourceIngestBar
              ingestEnabled={ingestEnabled}
              pageId={pageId}
              onAppendNodes={onAppendNodes}
            />
            {!ingestEnabled ? (
              <p className="text-xs text-muted-foreground">
                Web search and URL import require a synced page (turn off local-only and ensure you are
                online), then refresh.
              </p>
            ) : null}
            <textarea
              data-dim-background="full"
              readOnly={hasStructuredSources}
              aria-readOnly={hasStructuredSources}
              className={cn(
                glass(),
                "min-h-[10rem] w-full shrink-0 resize-y overflow-y-auto rounded-lg border border-border/70 p-4",
                "focus:bg-background-tertiary/75 dark:focus:bg-background-tertiary/75",
                "text-[15px] leading-7 font-normal text-foreground",
                "shadow-inner transition-[background-image,background-size] duration-200",
                NOTEBOOK_FOCUS_CLASS,
                hasStructuredSources && "cursor-default bg-muted/15 text-muted-foreground"
              )}
              placeholder={
                hasStructuredSources
                  ? "Combined text from sources (read-only). Remove all sources to edit raw directly."
                  : "Raw source text — or add structured sources above."
              }
              value={sections.raw_text.content}
              onChange={
                hasStructuredSources
                  ? undefined
                  : (e) => {
                      const v = e.target.value;
                      setSections((prev) => ({
                        ...prev,
                        raw_text: { ...prev.raw_text, content: v },
                      }));
                      queueRawAutosave();
                    }
              }
            />
          </div>
        ) : null}
        {sourceDocLayout !== "raw" ? (
          <div
            className={cn(
              glass({ opaque: true }),
              "flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border/60 p-5"
            )}
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
