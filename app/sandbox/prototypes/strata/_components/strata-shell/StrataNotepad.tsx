"use client";

import type { StrataTextSourceNode } from "@/lib/schemas/strata";

import { useCallback, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { toast } from "sonner";

import { BlockNotepadSurface } from "@/components/strata/notepad/BlockNotepadSurface";
import { cn } from "@/lib/utils";
import { sanitizeRawUserInput } from "@/lib/strata/input-safety";
import { type StrataLinkBlockStreamChunk, StrataLinkBlockStreamChunkSchema } from "@/lib/strata/link-block-status";
import { blocksToCanonicalMarkdown, type StrataNotepadBlock } from "@/lib/strata/notepad-blocks";

export type StrataNotepadProps = {
  /** Pass `activeNoteId` so PromptInput resets when swapping notes without fighting live typing. */
  noteId: string;
  pageId: string;
  title: string;
  onTitleChange: (title: string) => void;
  body: string;
  onBodyChange: (markdown: string) => void;
  blocks: StrataNotepadBlock[];
  onBlocksChange: (blocks: StrataNotepadBlock[]) => void;
  onAppendNodes?: (nodes: StrataTextSourceNode[]) => void;
  syncFooter: { busy: boolean; label: string };
  onFlushPersist: () => Promise<void>;
  onCloseNote?: () => void | Promise<void>;
  reduceMotion?: boolean | null;
  className?: string;
};

const TITLE_MAX_LENGTH = 512;

/**
 * Plain-text Strata scratch surface using the homepage glass prompt chrome.
 * Layered persistence (local vs Supabase) is owned by the shell via `sections.raw_text`.
 */
export function StrataNotepad({
  noteId,
  pageId,
  title,
  onTitleChange,
  body,
  onBodyChange,
  blocks,
  onBlocksChange,
  onAppendNodes,
  syncFooter,
  onFlushPersist,
  onCloseNote,
  reduceMotion,
  className,
}: StrataNotepadProps) {
  const [saving, setSaving] = useState(false);

  const persistBlocks = useCallback(
    (nextBlocks: StrataNotepadBlock[]) => {
      onBlocksChange(nextBlocks);
      const markdown = sanitizeRawUserInput(blocksToCanonicalMarkdown(nextBlocks));

      onBodyChange(markdown);
    },
    [onBlocksChange, onBodyChange]
  );

  const handleSaveNow = useCallback(async () => {
    setSaving(true);
    try {
      await onFlushPersist();
    } finally {
      setSaving(false);
    }
  }, [onFlushPersist]);

  const handleCloseNote = useCallback(async () => {
    if (!onCloseNote) return;
    setSaving(true);
    try {
      await onFlushPersist();
      await Promise.resolve(onCloseNote());
    } finally {
      setSaving(false);
    }
  }, [onCloseNote, onFlushPersist]);

  const wordCount = useMemo(() => {
    const t = body.trim();

    return t.length === 0 ? 0 : t.split(/\s+/u).length;
  }, [body]);

  const onProcessLink = useCallback(
    async ({
      blockId,
      url,
      onStatus,
    }: {
      blockId: string;
      url: string;
      onStatus: (message: string) => void;
    }) => {
      const response = await fetch("/api/prototypes/strata/link-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, noteId, blockId, url }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        throw new Error(data?.error || "Unable to process URL");
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("Missing streaming response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let title = "";
      let summary = "";
      let statusMessage = "Processing URL…";
      let estimatedCostUsd = 0;
      let streamError = "";
      const applyStatus = (chunk: StrataLinkBlockStreamChunk) => {
        if (chunk.type === "status") {
          statusMessage = chunk.event.message;
          onStatus(statusMessage);
        } else if (chunk.type === "result") {
          title = chunk.result.title;
          summary = chunk.result.summary;
          estimatedCostUsd = chunk.result.estimatedCostUsd;
        } else {
          streamError = chunk.error;
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lineBreak = buffer.indexOf("\n");
        while (lineBreak >= 0) {
          const line = buffer.slice(0, lineBreak).trim();

          buffer = buffer.slice(lineBreak + 1);
          if (line.length > 0) {
            try {
              const parsed = StrataLinkBlockStreamChunkSchema.safeParse(JSON.parse(line));

              if (parsed.success) {
                applyStatus(parsed.data);
              }
            } catch {
              // Ignore malformed stream chunks and continue.
            }
          }
          lineBreak = buffer.indexOf("\n");
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }
      if (!summary) {
        throw new Error("No summary returned");
      }

      return {
        title,
        summary,
        statusMessage:
          estimatedCostUsd > 0
            ? `Summary ready (~$${estimatedCostUsd.toFixed(4)})`
            : "Summary ready",
        estimatedCostUsd,
      };
    },
    [noteId, pageId]
  );

  const onEscalateLink = useCallback(
    async ({ url }: { blockId: string; url: string }) => {
      const res = await fetch("/api/prototypes/strata/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          op: "url_commit",
          url,
        }),
      });
      const data = (await res.json()) as { node?: StrataTextSourceNode; error?: string };

      if (!res.ok || !data.node) {
        throw new Error(data.error || "Unable to import full page");
      }

      onAppendNodes?.([data.node]);
      toast.success("Imported full page into saved sources");
    },
    [onAppendNodes, pageId]
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-2.5 overflow-hidden text-foreground",
        className
      )}
      data-strata-notepad
      data-note-id={noteId}
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
            disabled={saving || syncFooter.busy}
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
              disabled={saving || syncFooter.busy}
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

      <div className="flex min-h-0 flex-1 flex-col">
        <BlockNotepadSurface
          blocks={blocks}
          reduceMotion={reduceMotion}
          onBlocksChange={persistBlocks}
          onProcessLink={onProcessLink}
          onEscalateLink={onEscalateLink}
        />
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-border/15 px-3 py-2">
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {wordCount.toLocaleString()} words
        </span>
        <span
          className={cn("text-xs tabular-nums text-muted-foreground", syncFooter.busy ? "animate-pulse" : null)}
        >
          {syncFooter.label}
        </span>
      </div>
    </div>
  );
}

export default StrataNotepad;
