import { memo } from "react";
import { Pin, PinOff } from "lucide-react";

import { formatDate } from "@/lib/format/stringFormatting";
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

function safeFormatPublishedDate(iso?: string): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatDate(iso);
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
  const id =
    typeof o.id === "string" && o.id.length > 0 ? o.id : url || `exa-${index}`;
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
};

export const WebSearchToolResultCard = memo(function WebSearchToolResultCard({
  parsed,
  isPinned,
  onTogglePin,
}: WebSearchToolResultCardProps) {
  const summaryLabel =
    parsed.status === "error"
      ? "View details"
      : parsed.rows.length === 0
        ? "No results"
        : `${parsed.rows.length} result${parsed.rows.length === 1 ? "" : "s"}`;

  return (
    <div
      className={cn(
        "not-prose rounded-lg border border-border/60 bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-blur-2xl",
        "px-3 py-2",
        isPinned && "sticky top-20 z-30 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground truncate">Search Results</div>
        <button
          aria-label={isPinned ? "Unpin tool output" : "Pin tool output"}
          aria-pressed={isPinned}
          className={cn(
            "h-7 w-7 grid place-content-center rounded",
            "hover:bg-background-tertiary/60 transition-colors"
          )}
          type="button"
          onClick={onTogglePin}
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </button>
      </div>

      <details className="mt-1">
        <summary className="cursor-pointer select-none text-xs text-foreground/80 hover:text-foreground">
          {summaryLabel}
        </summary>

        {parsed.status === "error" && (
          <p className="mt-2 text-xs text-destructive">{parsed.message}</p>
        )}

        {parsed.status === "success" && parsed.rows.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No web results for this query.</p>
        )}

        {parsed.status === "success" && parsed.rows.length > 0 && (
          <ul className="mt-2 space-y-3 max-h-80 overflow-y-auto pr-1">
            {parsed.rows.map((row) => (
              <li key={row.id} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                <div className="flex gap-2">
                  {row.faviconUrl ? (
                    <img
                      alt=""
                      className="mt-0.5 size-4 shrink-0 rounded-sm"
                      height={16}
                      src={row.faviconUrl}
                      width={16}
                    />
                  ) : (
                    <span className="mt-0.5 size-4 shrink-0 rounded-sm bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <a
                      className="block text-sm font-medium text-foreground hover:underline"
                      href={row.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {row.title}
                    </a>
                    {row.url ? (
                      <a
                        className="block truncate text-xs text-primary hover:underline"
                        href={row.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {row.url}
                      </a>
                    ) : null}
                    {(() => {
                      const dateLine = safeFormatPublishedDate(row.publishedDate);
                      return dateLine ? (
                        <p className="text-[11px] text-muted-foreground">{dateLine}</p>
                      ) : null;
                    })()}
                    {row.highlightsLine ? (
                      <p className="text-xs leading-snug text-muted-foreground">{row.highlightsLine}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
});

WebSearchToolResultCard.displayName = "WebSearchToolResultCard";
