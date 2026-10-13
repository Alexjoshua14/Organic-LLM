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
  | { status: "success"; rows: WebSearchResultRowUi[]; queries?: string[] }
  | { status: "error"; message: string; queries?: string[] };

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

function normalizeHit(r: unknown, index: number, idPrefix?: string): WebSearchResultRowUi {
  const o = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
  const url = typeof o.url === "string" ? o.url : "";
  const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
  const title = titleRaw || url || `Result ${index + 1}`;
  const highlights = Array.isArray(o.highlights)
    ? o.highlights.filter((x): x is string => typeof x === "string")
    : [];
  const text = typeof o.text === "string" ? o.text : undefined;
  const publishedDate = typeof o.publishedDate === "string" ? o.publishedDate : undefined;
  const baseId = typeof o.id === "string" && o.id.length > 0 ? o.id : url || `exa-${index}`;
  const id = idPrefix ? `${idPrefix}:${baseId}` : baseId;
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

/** Parse a completed tool body, optionally namespacing row ids for merge safety. */
export function parseWebSearchToolOutputForFold(
  body: unknown,
  idPrefix?: string
): ParsedWebSearchToolOutput | null {
  const parsed = tryParseWebSearchToolOutput(body);

  if (!parsed || !idPrefix || parsed.status !== "success") return parsed;

  return {
    status: "success",
    rows: parsed.rows.map((row, i) => ({
      ...row,
      id: `${idPrefix}:${row.id || `exa-${i}`}`,
    })),
    queries: parsed.queries,
  };
}

function uniqueQueries(queries: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const q of queries) {
    const trimmed = q?.trim();

    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }

  return out;
}

/**
 * Appends one completed search's parsed context onto an existing combined result.
 * Does not create a new kind of completed state — only merges display context.
 */
export function appendWebSearchContext(
  existing: ParsedWebSearchToolOutput | null,
  next: { query?: string; parsed: ParsedWebSearchToolOutput }
): ParsedWebSearchToolOutput {
  const nextQueries = uniqueQueries([...(existing?.queries ?? []), next.query, ...(next.parsed.queries ?? [])]);

  if (!existing) {
    if (nextQueries.length === 0) return next.parsed;

    return next.parsed.status === "success"
      ? { ...next.parsed, queries: nextQueries }
      : { ...next.parsed, queries: nextQueries };
  }

  if (existing.status === "success" && next.parsed.status === "success") {
    return {
      status: "success",
      rows: [...existing.rows, ...next.parsed.rows],
      queries: nextQueries.length > 0 ? nextQueries : undefined,
    };
  }

  if (existing.status === "success") {
    // Keep the successful sources; fold the error into query context only when useful.
    return {
      status: "success",
      rows: existing.rows,
      queries: nextQueries.length > 0 ? nextQueries : undefined,
    };
  }

  if (next.parsed.status === "success") {
    return {
      status: "success",
      rows: next.parsed.rows,
      queries: nextQueries.length > 0 ? nextQueries : undefined,
    };
  }

  const messages = [existing.message, next.parsed.message].filter((m) => m.trim().length > 0);

  return {
    status: "error",
    message: messages.join(" · ") || "Web search failed.",
    queries: nextQueries.length > 0 ? nextQueries : undefined,
  };
}
