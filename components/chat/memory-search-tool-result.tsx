import type { MemorySearchInventory } from "@/lib/memory/memory-relevance";

import { memo } from "react";
import { Pin, PinOff } from "lucide-react";

import { cn } from "@/lib/utils";

const QUERY_DISPLAY_MAX = 56;

function truncateQueryForTitle(query: string): string {
  const t = query.trim();

  if (t.length <= QUERY_DISPLAY_MAX) return t;

  return `${t.slice(0, QUERY_DISPLAY_MAX)}…`;
}

export type MemorySearchRowUi = {
  id: string;
  memory: string;
  score?: number;
};

export type ParsedMemorySearchToolOutput =
  | {
      status: "ok";
      query: string;
      count: number;
      memories: MemorySearchRowUi[];
      /** Present when the server returned tier/sample metadata from the over-fetch search. */
      inventory?: MemorySearchInventory;
    }
  | { status: "error"; message: string };

function parseMemoryInventory(raw: unknown): MemorySearchInventory | undefined {
  if (raw === null || raw === undefined || typeof raw !== "object") return undefined;
  const inv = raw as Record<string, unknown>;
  const nums = [
    ["tier1", inv.tier1],
    ["tier2", inv.tier2],
    ["tier3", inv.tier3],
    ["belowThresholdInSample", inv.belowThresholdInSample],
    ["noScoreInSample", inv.noScoreInSample],
    ["sampleSize", inv.sampleSize],
    ["retrievedLimit", inv.retrievedLimit],
    ["injectedCap", inv.injectedCap],
  ] as const;

  for (const [, v] of nums) {
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  }

  return {
    tier1: inv.tier1 as number,
    tier2: inv.tier2 as number,
    tier3: inv.tier3 as number,
    belowThresholdInSample: inv.belowThresholdInSample as number,
    noScoreInSample: inv.noScoreInSample as number,
    sampleSize: inv.sampleSize as number,
    retrievedLimit: inv.retrievedLimit as number,
    injectedCap: inv.injectedCap as number,
  };
}

/**
 * Parses the `search_memories` tool return from {@link createMemorySearchTool}.
 */
export function tryParseMemorySearchToolOutput(body: unknown): ParsedMemorySearchToolOutput | null {
  if (body === null || body === undefined || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (typeof o.success !== "boolean") return null;
  if (typeof o.query !== "string") return null;
  if (!Array.isArray(o.memories)) return null;
  if (typeof o.count !== "number" || !Number.isFinite(o.count)) return null;

  if (!o.success) {
    const err = o.error;
    const message =
      typeof err === "string" && err.trim().length > 0 ? err.trim() : "Memory search failed.";

    return { status: "error", message };
  }

  const memories: MemorySearchRowUi[] = o.memories.map((m, i) => {
    const row = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
    const id = typeof row.id === "string" && row.id.length > 0 ? row.id : `mem-${i}`;
    const memory = typeof row.memory === "string" ? row.memory : "";
    const score =
      typeof row.score === "number" && Number.isFinite(row.score) ? row.score : undefined;

    return { id, memory, score };
  });

  return {
    status: "ok",
    query: o.query,
    count: Math.max(0, Math.floor(o.count)),
    memories,
    inventory: parseMemoryInventory(o.memoryInventory),
  };
}

type MemorySearchToolResultCardProps = {
  parsed: ParsedMemorySearchToolOutput;
  isPinned: boolean;
  onTogglePin: () => void;
  showPin?: boolean;
};

export const MemorySearchToolResultCard = memo(function MemorySearchToolResultCard({
  parsed,
  isPinned,
  onTogglePin,
  showPin = true,
}: MemorySearchToolResultCardProps) {
  if (parsed.status === "error") {
    return (
      <div
        className={cn(
          "not-prose rounded-lg border border-border/60 bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-blur-2xl",
          "px-3 py-2",
          isPinned && "sticky top-20 z-30 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground">Memory search error</div>
            <p className="mt-1 text-xs leading-snug text-destructive">{parsed.message}</p>
          </div>
          {showPin ? (
            <button
              aria-label={isPinned ? "Unpin tool output" : "Pin tool output"}
              aria-pressed={isPinned}
              className={cn(
                "h-7 w-7 shrink-0 grid place-content-center rounded",
                "hover:bg-background-tertiary/60 transition-colors"
              )}
              type="button"
              onClick={onTogglePin}
            >
              {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const { count, query, memories, inventory } = parsed;
  const qShort = truncateQueryForTitle(query);
  const titleLine = `Fetched ${count} ${count === 1 ? "memory" : "memories"} on “${qShort}”`;
  const tierLine =
    inventory !== undefined
      ? `Sample ${inventory.sampleSize} (top ${inventory.retrievedLimit}): tier1 ${inventory.tier1} · tier2 ${inventory.tier2} · tier3 ${inventory.tier3} · below min ${inventory.belowThresholdInSample} · no score ${inventory.noScoreInSample}`
      : null;

  return (
    <div
      className={cn(
        "not-prose rounded-lg border border-border/60 bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-blur-2xl",
        "px-3 py-2",
        isPinned && "sticky top-20 z-30 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
            {titleLine}
          </summary>

          {tierLine ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground tabular-nums">
              {tierLine}
            </p>
          ) : null}

          {memories.length === 0 ? (
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
              No memories matched this query.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1 max-h-72 overflow-y-auto pr-1">
              {memories.map((m) => (
                <li
                  key={m.id}
                  className="text-[10px] leading-snug text-foreground/85 line-clamp-2"
                >
                  {m.memory}
                </li>
              ))}
            </ul>
          )}
        </details>
        {showPin ? (
          <button
            aria-label={isPinned ? "Unpin tool output" : "Pin tool output"}
            aria-pressed={isPinned}
            className={cn(
              "h-7 w-7 shrink-0 grid place-content-center rounded",
              "hover:bg-background-tertiary/60 transition-colors"
            )}
            type="button"
            onClick={onTogglePin}
          >
            {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
});

MemorySearchToolResultCard.displayName = "MemorySearchToolResultCard";
