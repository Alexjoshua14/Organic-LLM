"use client";

import type { MemorySearchInventory } from "@/lib/memory/memory-relevance";

import { memo, useState } from "react";

import {
  ToolResultInlineRow,
  ToolResultPinButton,
  toolResultErrorSummaryButtonClass,
  toolResultExpandedDetailClass,
  toolResultSummaryButtonClass,
} from "./tool-result-inline";

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
  const [expanded, setExpanded] = useState(false);

  if (parsed.status === "error") {
    return (
      <ToolResultInlineRow
        isPinned={isPinned}
        pin={
          <ToolResultPinButton
            isPinned={isPinned}
            showPin={showPin}
            onTogglePin={onTogglePin}
          />
        }
      >
        <button
          className={toolResultErrorSummaryButtonClass}
          type="button"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="text-destructive/90">Memory search error</span>
          {expanded ? (
            <span className={`${toolResultExpandedDetailClass} text-muted-foreground`}>
              {parsed.message}
            </span>
          ) : null}
        </button>
      </ToolResultInlineRow>
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
    <ToolResultInlineRow
      isPinned={isPinned}
      pin={
        <ToolResultPinButton isPinned={isPinned} showPin={showPin} onTogglePin={onTogglePin} />
      }
    >
      <button
        className={toolResultSummaryButtonClass}
        type="button"
        onClick={() => setExpanded((open) => !open)}
      >
        <span>{titleLine}</span>
        {expanded ? (
          <>
            {tierLine ? (
              <span className={`${toolResultExpandedDetailClass} tabular-nums`}>{tierLine}</span>
            ) : null}
            {memories.length === 0 ? (
              <span className={toolResultExpandedDetailClass}>
                No memories matched this query.
              </span>
            ) : (
              <ul className="mt-0.5 max-h-72 space-y-1 overflow-y-auto pr-1">
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
          </>
        ) : null}
      </button>
    </ToolResultInlineRow>
  );
});

MemorySearchToolResultCard.displayName = "MemorySearchToolResultCard";
