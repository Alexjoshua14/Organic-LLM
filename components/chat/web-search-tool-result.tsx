"use client";

import { memo, useState } from "react";

import {
  ToolResultInlineRow,
  ToolResultPinButton,
  toolResultErrorSummaryButtonClass,
  toolResultExpandedDetailClass,
  toolResultSummaryButtonClass,
} from "./tool-result-inline";

import type { ParsedWebSearchToolOutput } from "@/lib/chat/web-search-tool-output";

export type {
  ParsedWebSearchToolOutput,
  WebSearchResultRowUi,
} from "@/lib/chat/web-search-tool-output";
export { tryParseWebSearchToolOutput } from "@/lib/chat/web-search-tool-output";

type WebSearchToolResultCardProps = {
  parsed: ParsedWebSearchToolOutput;
  isPinned: boolean;
  onTogglePin: () => void;
  showPin?: boolean;
};

export const WebSearchToolResultCard = memo(function WebSearchToolResultCard({
  parsed,
  isPinned,
  onTogglePin,
  showPin = true,
}: WebSearchToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const queries = parsed.queries?.filter((q) => q.trim().length > 0) ?? [];

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
          <span className="text-destructive/90">Search error</span>
          {expanded ? (
            <span className={`${toolResultExpandedDetailClass} text-muted-foreground`}>
              {queries.length > 0 ? (
                <span className="mb-0.5 block text-muted-foreground/80">
                  {queries.length === 1 ? `Query: ${queries[0]}` : `Queries: ${queries.join(" · ")}`}
                </span>
              ) : null}
              {parsed.message}
            </span>
          ) : null}
        </button>
      </ToolResultInlineRow>
    );
  }

  const summaryLabel =
    parsed.rows.length === 0
      ? "No search results"
      : `${parsed.rows.length} Search Result${parsed.rows.length === 1 ? "" : "s"}`;

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
        <span>{summaryLabel}</span>
        {expanded ? (
          parsed.rows.length === 0 ? (
            <span className={`${toolResultExpandedDetailClass} text-muted-foreground`}>
              {queries.length > 0 ? (
                <span className="mb-0.5 block text-muted-foreground/80">
                  {queries.length === 1 ? `Query: ${queries[0]}` : `Queries: ${queries.join(" · ")}`}
                </span>
              ) : null}
              No web results for this query.
            </span>
          ) : (
            <span className="mt-0.5 block">
              {queries.length > 0 ? (
                <span className="mb-1 block text-2xs leading-snug text-muted-foreground/80">
                  {queries.length === 1 ? `Query: ${queries[0]}` : `Queries: ${queries.join(" · ")}`}
                </span>
              ) : null}
              <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {parsed.rows.map((row) => (
                  <li key={row.id} className="min-w-0">
                    {row.url ? (
                      <a
                        className="block truncate text-2xs font-medium text-foreground hover:underline"
                        href={row.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {row.title}
                      </a>
                    ) : (
                      <p className="truncate text-2xs font-medium text-foreground">{row.title}</p>
                    )}
                    {row.highlightsLine ? (
                      <p className="line-clamp-1 text-2xs leading-snug text-muted-foreground/80">
                        {row.highlightsLine}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </span>
          )
        ) : null}
      </button>
    </ToolResultInlineRow>
  );
});

WebSearchToolResultCard.displayName = "WebSearchToolResultCard";
