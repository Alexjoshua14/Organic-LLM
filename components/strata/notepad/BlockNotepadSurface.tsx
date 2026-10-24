"use client";

import type { KeyboardEvent } from "react";
import type { StrataNotepadBlock } from "@/lib/strata/notepad-blocks";

import { useEffect, useMemo, useRef } from "react";
import { Link2, Loader2, Plus, Search, Trash2 } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import ShinyText from "@/components/ShinyText";
import { cn } from "@/lib/utils";

type LinkProcessResult = {
  title: string;
  summary: string;
  statusMessage?: string;
  estimatedCostUsd?: number;
};

export type BlockNotepadSurfaceProps = {
  blocks: StrataNotepadBlock[];
  reduceMotion?: boolean | null;
  onBlocksChange: (next: StrataNotepadBlock[]) => void;
  onProcessLink: (args: {
    blockId: string;
    url: string;
    onStatus: (message: string) => void;
  }) => Promise<LinkProcessResult>;
  onEscalateLink?: (args: { blockId: string; url: string }) => Promise<void>;
};

function updateBlock(
  blocks: StrataNotepadBlock[],
  blockId: string,
  updater: (block: StrataNotepadBlock) => StrataNotepadBlock
): StrataNotepadBlock[] {
  return blocks.map((block) => (block.id === blockId ? updater(block) : block));
}

export function BlockNotepadSurface({
  blocks,
  reduceMotion,
  onBlocksChange,
  onProcessLink,
  onEscalateLink,
}: BlockNotepadSurfaceProps) {
  const textRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const latestBlocksRef = useRef(blocks);
  const hasProcessingBlock = useMemo(
    () => blocks.some((block) => block.type === "link" && block.state === "processing"),
    [blocks]
  );

  useEffect(() => {
    latestBlocksRef.current = blocks;
  }, [blocks]);

  const pushBlocks = (next: StrataNotepadBlock[]) => {
    latestBlocksRef.current = next;
    onBlocksChange(next);
  };

  const handleTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const block = blocks[index];

    if (!block || block.type !== "text") return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const next = [...blocks];

      next.splice(index + 1, 0, {
        id: crypto.randomUUID(),
        type: "text",
        text: "",
      });
      pushBlocks(next);
      queueMicrotask(() => textRefs.current[next[index + 1]!.id]?.focus());

      return;
    }

    if (
      event.key === "Backspace" &&
      block.text.length === 0 &&
      blocks.length > 1 &&
      index > 0 &&
      blocks[index - 1]?.type === "text"
    ) {
      event.preventDefault();
      const previousId = blocks[index - 1]!.id;
      const next = blocks.filter((candidate) => candidate.id !== block.id);

      pushBlocks(next);
      queueMicrotask(() => textRefs.current[previousId]?.focus());
    }
  };

  const handleProcessLink = async (blockId: string) => {
    const block = blocks.find((candidate) => candidate.id === blockId);

    if (!block || block.type !== "link") return;
    const url = block.url.trim();

    if (!url) return;

    pushBlocks(
      updateBlock(latestBlocksRef.current, blockId, (candidate) =>
        candidate.type !== "link"
          ? candidate
          : {
              ...candidate,
              state: "processing",
              statusMessage: "Input received from user",
              errorMessage: undefined,
            }
      )
    );

    try {
      const result = await onProcessLink({
        blockId,
        url,
        onStatus: (message) => {
          pushBlocks(
            updateBlock(latestBlocksRef.current, blockId, (candidate) =>
              candidate.type === "link"
                ? { ...candidate, state: "processing", statusMessage: message }
                : candidate
            )
          );
        },
      });

      pushBlocks(
        updateBlock(latestBlocksRef.current, blockId, (candidate) =>
          candidate.type !== "link"
            ? candidate
            : {
                ...candidate,
                state: "resolved",
                title: result.title,
                summary: result.summary,
                statusMessage: result.statusMessage ?? "Search results and summary ready",
                errorMessage: undefined,
              }
        )
      );
    } catch (error) {
      pushBlocks(
        updateBlock(latestBlocksRef.current, blockId, (candidate) =>
          candidate.type !== "link"
            ? candidate
            : {
                ...candidate,
                state: "error",
                statusMessage: "Processing failed",
                errorMessage: error instanceof Error ? error.message : "Failed to process URL",
              }
        )
      );
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain pr-1"
      data-adaptive-active={hasProcessingBlock ? "true" : undefined}
      data-dim-background={hasProcessingBlock ? "full" : undefined}
    >
      {blocks.map((block, index) => {
        if (block.type === "text") {
          return (
            <div
              key={block.id}
              className={cn(
                glass({ opaque: true }),
                "rounded-xl border border-border/60 bg-background/50 p-3 transition-colors focus-within:border-primary/40"
              )}
            >
              <textarea
                ref={(node) => {
                  textRefs.current[block.id] = node;
                }}
                value={block.text}
                placeholder="Write a thought..."
                onChange={(event) =>
                  pushBlocks(
                    updateBlock(blocks, block.id, (candidate) =>
                      candidate.type === "text"
                        ? {
                            ...candidate,
                            text: event.currentTarget.value,
                          }
                        : candidate
                    )
                  )
                }
                onKeyDown={(event) => handleTextKeyDown(event, index)}
                className={cn(
                  "min-h-[96px] w-full resize-y bg-transparent text-base leading-7 text-foreground outline-none",
                  "placeholder:text-muted-foreground"
                )}
              />
            </div>
          );
        }

        const processing = block.state === "processing";
        const resolved = block.state === "resolved";
        const errored = block.state === "error";

        return (
          <div
            key={block.id}
            className={cn(
              glass({ opaque: true }),
              "rounded-xl border border-border/60 bg-background/50 p-3 transition-all",
              processing && "ring-1 ring-primary/40"
            )}
          >
            <div className="flex items-center gap-2 pb-2">
              <Link2 className="size-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Link block</p>
            </div>

            <input
              type="url"
              value={block.url}
              disabled={processing}
              placeholder="https://example.com"
              onChange={(event) =>
                pushBlocks(
                  updateBlock(blocks, block.id, (candidate) =>
                    candidate.type === "link"
                      ? {
                          ...candidate,
                          url: event.currentTarget.value,
                          errorMessage: undefined,
                        }
                      : candidate
                  )
                )
              }
              className={cn(
                glass(),
                "w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
              )}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={processing || block.url.trim().length === 0}
                onClick={() => void handleProcessLink(block.id)}
                className={cn(
                  glass({ opaque: true }),
                  "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium",
                  "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {processing ? (
                  <Loader2 className={cn("size-3.5", reduceMotion ? "" : "animate-spin")} />
                ) : (
                  <Search className="size-3.5" />
                )}
                Confirm search
              </button>

              <button
                type="button"
                onClick={() => pushBlocks(blocks.filter((candidate) => candidate.id !== block.id))}
                className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>

              {resolved && onEscalateLink ? (
                <button
                  type="button"
                  onClick={() => void onEscalateLink({ blockId: block.id, url: block.url })}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1.5 text-xs text-primary hover:bg-primary/10"
                >
                  Import full page
                </button>
              ) : null}
            </div>

            {processing ? (
              <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                <ShinyText
                  text={block.statusMessage ?? "Processing URL…"}
                  speed={reduceMotion ? 9 : 6}
                  accentShimmer={!reduceMotion}
                />
              </div>
            ) : null}

            {resolved && block.summary ? (
              <div className="mt-3 space-y-1 rounded-md border border-border/50 bg-background/70 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{block.title || block.url}</p>
                <p className="text-muted-foreground">{block.summary}</p>
              </div>
            ) : null}

            {errored ? (
              <p className="mt-2 text-xs text-destructive">
                {block.errorMessage ?? "Unable to process URL."}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex items-center gap-2 pb-1">
        <button
          type="button"
          onClick={() =>
            pushBlocks([
              ...blocks,
              {
                id: crypto.randomUUID(),
                type: "text",
                text: "",
              },
            ])
          }
          className={cn(
            glass({ opaque: true }),
            "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          )}
        >
          <Plus className="size-3.5" />
          Add text block
        </button>
        <button
          type="button"
          onClick={() =>
            pushBlocks([
              ...blocks,
              {
                id: crypto.randomUUID(),
                type: "link",
                url: "",
                state: "idle",
              },
            ])
          }
          className={cn(
            glass({ opaque: true }),
            "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          )}
        >
          <Link2 className="size-3.5" />
          Add link block
        </button>
      </div>
    </div>
  );
}
