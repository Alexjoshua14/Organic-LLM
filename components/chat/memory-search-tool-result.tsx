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
  | { status: "ok"; query: string; count: number; memories: MemorySearchRowUi[] }
  | { status: "error"; message: string };

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
  };
}

type MemorySearchToolResultCardProps = {
  parsed: ParsedMemorySearchToolOutput;
  isPinned: boolean;
  onTogglePin: () => void;
};

export const MemorySearchToolResultCard = memo(function MemorySearchToolResultCard({
  parsed,
  isPinned,
  onTogglePin,
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
        </div>
      </div>
    );
  }

  const { count, query, memories } = parsed;
  const qShort = truncateQueryForTitle(query);
  const titleLine = `Fetched ${count} ${count === 1 ? "memory" : "memories"} on “${qShort}”`;

  const summaryLabel =
    memories.length === 0
      ? "No memories"
      : `${memories.length} memor${memories.length === 1 ? "y" : "ies"}`;

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
          <div className="text-xs font-medium text-foreground">{titleLine}</div>
        </div>
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
      </div>

      <details className="mt-1">
        <summary className="cursor-pointer select-none text-[11px] text-foreground/80 hover:text-foreground">
          View memories — {summaryLabel}
        </summary>

        {memories.length === 0 ? (
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            No memories matched this query.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {memories.map((m) => (
              <li
                key={m.id}
                className="border-b border-border/40 pb-1.5 last:border-0 last:pb-0 text-[10px] leading-tight text-foreground/85"
              >
                <p>{m.memory}</p>
                {m.score !== undefined ? (
                  <p className="mt-0.5 text-[8px] leading-tight text-muted-foreground tabular-nums">
                    Score: {m.score.toFixed(3)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
});

MemorySearchToolResultCard.displayName = "MemorySearchToolResultCard";
