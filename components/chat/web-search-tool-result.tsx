import { memo } from "react";
import { Pin, PinOff } from "lucide-react";

import { buildFavicon } from "@/lib/exa/utils";
import { cn } from "@/lib/utils";

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

  if (!Array.isArray(results)) {
    if (hasErr) {
      const err = b.error;
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Search failed";

      return { status: "error", message };
    }

    return null;
  }

  if (hasErr && results.length === 0) {
    const err = b.error;
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Search failed";

    return { status: "error", message };
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
            <div className="text-xs font-medium text-foreground">Search error</div>
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

  const summaryLabel =
    parsed.rows.length === 0
      ? "No search results"
      : `${parsed.rows.length} Search Result${parsed.rows.length === 1 ? "" : "s"}`;

  return (
    <div
      className={cn(
        "not-prose rounded-lg border border-border/60 bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-blur-2xl",
        "px-3 py-2",
        isPinned && "sticky top-20 z-30 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer select-none truncate text-xs font-medium text-muted-foreground hover:text-foreground">
            {summaryLabel}
          </summary>

          {parsed.rows.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No web results for this query.</p>
          )}

          {parsed.rows.length > 0 && (
            <ul className="mt-1.5 space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {parsed.rows.map((row) => (
                <li key={row.id} className="min-w-0">
                  {row.url ? (
                    <a
                      className="block truncate text-xs font-medium text-foreground hover:underline"
                      href={row.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {row.title}
                    </a>
                  ) : (
                    <p className="truncate text-xs font-medium text-foreground">{row.title}</p>
                  )}
                  {row.highlightsLine ? (
                    <p className="line-clamp-1 text-[10px] leading-snug text-muted-foreground/80">
                      {row.highlightsLine}
                    </p>
                  ) : null}
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

WebSearchToolResultCard.displayName = "WebSearchToolResultCard";
