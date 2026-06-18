"use client";

import { memo, useState } from "react";

import {
  ToolResultInlineRow,
  ToolResultPinButton,
  toolResultErrorSummaryButtonClass,
  toolResultExpandedDetailClass,
  toolResultSummaryButtonClass,
} from "./tool-result-inline";

import { buildFavicon } from "@/lib/exa/utils";

const HIGHLIGHTS_MAX_LEN = 280;

export type WebSearchResultRowUi = {
  id: string;
  title: string;
  url: string;
  faviconUrl?: string;
  highlightsLine: string;
  publishedDate?: string;
};

export type ParsedWebSearchToolOutput =
  | { status: "success"; rows: WebSearchResultRowUi[] }
  | { status: "error"; message: string };

function condenseHighlights(highlights: string[], textFallback?: string): string {
  if (highlights.length > 0) {
    const joined = highlights.join(" · ");

    return joined.length > HIGHLIGHTS_MAX_LEN
      ? `${joined.slice(0, HIGHLIGHTS_MAX_LEN).trimEnd()}…`
      : joined;
  }
  if (textFallback?.trim()) {
    const t = textFallback.trim().replace(/\s+/g, " ");

    return t.length > HIGHLIGHTS_MAX_LEN ? `${t.slice(0, HIGHLIGHTS_MAX_LEN).trimEnd()}…` : t;
  }

  return "";
}

function normalizeHit(r: unknown, index: number): WebSearchResultRowUi {
  const o = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
  const url = typeof o.url === "string" ? o.url : "";
  const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
  const title = titleRaw || url || `Result ${index + 1}`;
  const highlights = Array.isArray(o.highlights)
    ? o.highlights.filter((x): x is string => typeof x === "string")
    : [];
  const text = typeof o.text === "string" ? o.text : undefined;
  const publishedDate = typeof o.publishedDate === "string" ? o.publishedDate : undefined;
  const id = typeof o.id === "string" && o.id.length > 0 ? o.id : url || `exa-${index}`;
  const existingFav = typeof o.faviconUrl === "string" ? o.faviconUrl : undefined;
  const faviconUrl = existingFav || (url ? buildFavicon(url) : undefined);

  return {
    id,
    title,
    url,
    faviconUrl,
    highlightsLine: condenseHighlights(highlights, text),
    publishedDate,
  };
}

/**
 * Parses the `web_search` tool execute payload (Exa `Result` or raw `{ results }`).
 * Omits backend-only fields (latency, cost, etc.) from the returned rows.
 */
export function tryParseWebSearchToolOutput(body: unknown): ParsedWebSearchToolOutput | null {
  if (body === null || body === undefined || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;
  let results: unknown[] | undefined;

  if (b.data !== null && b.data !== undefined && typeof b.data === "object") {
    const d = b.data as Record<string, unknown>;

    if (Array.isArray(d.results)) results = d.results;
  }
  if (!results && Array.isArray(b.results)) results = b.results;

  const hasErr = b.error != null && b.error !== false;
  const errMsg =
    typeof b.error === "string"
      ? b.error
      : typeof b.message === "string"
        ? b.message
        : undefined;

  if (hasErr || (results === undefined && errMsg)) {
    return {
      status: "error",
      message: errMsg?.trim() || "Web search failed.",
    };
  }

  if (!results) {
    return null;
  }

  return {
    status: "success",
    rows: results.map((r, i) => normalizeHit(r, i)),
  };
}

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
              No web results for this query.
            </span>
          ) : (
            <ul className="mt-0.5 max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {parsed.rows.map((row) => (
                <li key={row.id} className="min-w-0">
                  {row.url ? (
                    <a
                      className="block truncate text-[10px] font-medium text-foreground hover:underline"
                      href={row.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {row.title}
                    </a>
                  ) : (
                    <p className="truncate text-[10px] font-medium text-foreground">{row.title}</p>
                  )}
                  {row.highlightsLine ? (
                    <p className="line-clamp-1 text-[10px] leading-snug text-muted-foreground/80">
                      {row.highlightsLine}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </button>
    </ToolResultInlineRow>
  );
});

WebSearchToolResultCard.displayName = "WebSearchToolResultCard";
