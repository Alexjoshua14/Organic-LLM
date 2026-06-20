import "server-only";

import {
  assertSafePublicHttpsUrlResolved,
  type DnsLookupFn,
} from "./safe-url-resolved";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; OrganicLLM/1.0; +https://organic-llm.com/bot)";

const ALLOWED_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
]);

export type SafeFetchFn = typeof fetch;

export type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  fetchImpl?: SafeFetchFn;
  lookup?: DnsLookupFn;
};

export type SafeFetchResult =
  | {
      ok: true;
      body: string;
      finalUrl: string;
      contentType: string | null;
    }
  | {
      ok: false;
      reason: string;
      code:
        | "unsafe_url"
        | "dns_blocked"
        | "fetch_failed"
        | "content_type"
        | "size_exceeded"
        | "redirect_blocked";
    };

async function readBodyWithLimit(
  response: Response,
  maxBytes: number
): Promise<{ ok: true; body: string } | { ok: false; reason: string; code: "size_exceeded" }> {
  if (!response.body) {
    const text = await response.text();

    if (text.length > maxBytes) {
      return { ok: false, reason: "Response body exceeds size limit", code: "size_exceeded" };
    }

    return { ok: true, body: text };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    if (!value) continue;

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel();

      return { ok: false, reason: "Response body exceeds size limit", code: "size_exceeded" };
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body: new TextDecoder("utf-8", { fatal: false }).decode(merged) };
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveRedirectLocation(currentUrl: string, location: string | null): string | null {
  if (!location) return null;

  try {
    return new URL(location, currentUrl).href;
  } catch {
    return null;
  }
}

function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return true;

  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  return ALLOWED_CONTENT_TYPES.has(base);
}

/**
 * Hardened GET fetch: DNS-validated URLs, manual redirect re-validation, byte cap, content-type allowlist.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookup = options.lookup;

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safe = await assertSafePublicHttpsUrlResolved(currentUrl, lookup);

    if (!safe.ok) {
      return {
        ok: false,
        reason: safe.reason,
        code: safe.reason.includes("Resolved") || safe.reason.includes("resolved")
          ? "dns_blocked"
          : "unsafe_url",
      };
    }

    let response: Response;

    try {
      response = await fetchImpl(safe.href, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
          "User-Agent": userAgent,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Fetch failed",
        code: "fetch_failed",
      };
    }

    if (isRedirectStatus(response.status)) {
      const nextUrl = resolveRedirectLocation(safe.href, response.headers.get("location"));

      if (!nextUrl) {
        return { ok: false, reason: "Redirect missing Location header", code: "redirect_blocked" };
      }

      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: `HTTP ${response.status}`,
        code: "fetch_failed",
      };
    }

    const contentType = response.headers.get("content-type");

    if (!isAllowedContentType(contentType)) {
      return {
        ok: false,
        reason: `Content type not allowed: ${contentType ?? "unknown"}`,
        code: "content_type",
      };
    }

    const bodyResult = await readBodyWithLimit(response, maxBytes);

    if (!bodyResult.ok) {
      return bodyResult;
    }

    return {
      ok: true,
      body: bodyResult.body,
      finalUrl: safe.href,
      contentType,
    };
  }

  return { ok: false, reason: "Too many redirects", code: "redirect_blocked" };
}
