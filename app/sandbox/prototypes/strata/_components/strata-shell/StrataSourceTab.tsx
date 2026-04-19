"use client";

import type { Dispatch, SetStateAction } from "react";
import type { StrataPageWithSections } from "@/lib/schemas/strata";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpenText, Columns2, SquarePen } from "lucide-react";
import { motion } from "framer-motion";

import { NOTEBOOK_FOCUS_CLASS, type SourceDocLayout } from "./strata-shell-model";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/third-party/ui/context-menu";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function StrataSourceTab({
  rawSubtitle,
  sourceDocLayout,
  setSourceDocLayout,
  reduceMotion,
  sections,
  setSections,
  refinedSectionTitle,
  queueRawAutosave,
  flushSaveRaw,
}: {
  rawSubtitle: string;
  sourceDocLayout: SourceDocLayout;
  setSourceDocLayout: (layout: SourceDocLayout) => void;
  reduceMotion: boolean | null;
  sections: StrataPageWithSections["sections"];
  setSections: Dispatch<SetStateAction<StrataPageWithSections["sections"]>>;
  refinedSectionTitle: string;
  queueRawAutosave: () => void;
  flushSaveRaw: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 pr-1 text-xs text-muted-foreground">{rawSubtitle}</p>
        <div className="sticky top-3 z-30 shrink-0 self-start rounded-full bg-background/85 py-0.5 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70">
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
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-4 pb-2",
          sourceDocLayout === "split" ? "lg:grid-cols-2 lg:items-stretch" : "grid-cols-1"
        )}
      >
        {sourceDocLayout !== "refined" ? (
          <textarea
            data-dim-background="full"
            className={cn(
              glass(),
              "min-h-[min(60dvh,32rem)] w-full flex-1 resize-y rounded-lg border border-border/70 p-5 lg:min-h-[min(calc(100dvh-14rem),42rem)]",
              "focus:bg-background-tertiary/75 dark:focus:bg-background-tertiary/75",
              "text-[15px] leading-7 font-normal text-foreground",
              "shadow-inner transition-[background-image,background-size] duration-200",
              NOTEBOOK_FOCUS_CLASS,
              sourceDocLayout === "split" ? "max-lg:min-h-[40dvh]" : ""
            )}
            value={sections.raw_text.content}
            onChange={(e) => {
              const v = e.target.value;

              setSections((prev) => ({
                ...prev,
                raw_text: { ...prev.raw_text, content: v },
              }));
              queueRawAutosave();
            }}
          />
        ) : null}
        {sourceDocLayout !== "raw" ? (
          <div
            className={cn(
              glass({ opaque: true }),
              "min-h-[min(60dvh,32rem)] w-full overflow-y-auto rounded-lg border border-border/60 p-5 lg:min-h-[min(calc(100dvh-14rem),42rem)]",
              sourceDocLayout === "split" ? "max-lg:min-h-[40dvh]" : ""
            )}
          >
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {refinedSectionTitle}
            </p>
            <div className="prose prose-neutral max-w-none text-[15px] leading-7 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {sections.refined_text.content ||
                  "_No refined preview yet. Use **Generate** in Synthesis after saving source._"}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          className={cn(
            glass({ opaque: true }),
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          )}
          type="button"
          onClick={flushSaveRaw}
        >
          Save now
        </button>
        <p className="text-xs text-muted-foreground">
          Edits also save automatically after you pause typing.
        </p>
      </div>
    </div>
  );
}
