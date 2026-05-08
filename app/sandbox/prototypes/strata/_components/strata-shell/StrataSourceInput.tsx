"use client";

import type { ReactNode } from "react";
import { NotebookPen } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import type { StrataTextSourceNode } from "@/lib/schemas/strata";

import {
  STRATA_INGEST_MODE_LABEL,
  StrataSourceIngestPanels,
  strataIngestModeIcon,
  type StrataIngestMode,
} from "./StrataSourceIngestBar";

export type StrataSourceInputMode = "note" | StrataIngestMode;

const INGEST_MODES: StrataIngestMode[] = ["web", "url", "files", "flipboard", "audio"];

/**
 * Single chrome for the Source column: notepad and ingest flows are mode variants of one surface.
 */
export function StrataSourceInput({
  mode,
  onModeChange,
  notepadEnabled,
  activeNoteId,
  ingestEnabled,
  pageId,
  reduceMotion,
  ingesting,
  notepad,
  onAppendNodes,
  onClipboardPasteToNotepad,
  className,
}: {
  mode: StrataSourceInputMode;
  onModeChange: (next: StrataSourceInputMode) => void;
  notepadEnabled: boolean;
  activeNoteId: string | null;
  ingestEnabled: boolean;
  pageId: string;
  reduceMotion?: boolean | null;
  ingesting: boolean;
  notepad: ReactNode;
  onAppendNodes: (nodes: StrataTextSourceNode[]) => void;
  onClipboardPasteToNotepad: (text: string, suggestedTitle: string) => void;
  className?: string;
}) {
  const noteDisabled = !notepadEnabled || !activeNoteId;

  const handleIngestSegment = (m: StrataIngestMode) => {
    if (mode === m && notepadEnabled) {
      onModeChange("note");

      return;
    }
    onModeChange(m);
  };

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "flex min-h-[min(14rem,40vh)] flex-1 flex-col overflow-hidden rounded-xl border border-border/60",
        ingesting && "relative z-30 ring-2 ring-primary/30",
        className
      )}
    >
      <div
        role="tablist"
        aria-label="Source input mode"
        className="flex flex-wrap items-center gap-2 border-b border-border/40 bg-muted/10 px-3 py-2.5"
      >
        {notepadEnabled ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "note"}
            disabled={noteDisabled}
            title={noteDisabled ? "Create or select a note first" : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              mode === "note"
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              noteDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
            )}
            onClick={() => {
              if (!noteDisabled) onModeChange("note");
            }}
          >
            <NotebookPen className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Note
          </button>
        ) : null}

        {INGEST_MODES.map((m) => {
          const isActive = mode === m;
          const Icon = strataIngestModeIcon(m);

          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => handleIngestSegment(m)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {STRATA_INGEST_MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col p-4",
          mode === "note"
            ? "min-h-0 overflow-hidden"
            : "min-h-0 overflow-y-auto overscroll-y-contain"
        )}
      >
        {mode === "note" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{notepad}</div>
        ) : (
          <StrataSourceIngestPanels
            pageId={pageId}
            ingestEnabled={ingestEnabled}
            reduceMotion={reduceMotion}
            mode={mode}
            onModeChange={(next) => {
              if (next === null) onModeChange(notepadEnabled ? "note" : "web");
              else onModeChange(next);
            }}
            onAppendNodes={onAppendNodes}
            onClipboardPasteToNotepad={onClipboardPasteToNotepad}
          />
        )}
      </div>
    </div>
  );
}
