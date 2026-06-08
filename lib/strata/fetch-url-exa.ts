import { assertSafePublicHttpsUrl } from "./safe-url";

import { getContents } from "@/lib/exa/client";

const PREVIEW_MAX = 8000;
const COMMIT_MAX = 120_000;

export type FetchUrlExaResult =
  | { ok: true; text: string; titleHint: string }
  | { ok: false; error: string };

/**
 * Fetches page text via Exa contents API only (no origin fetch / SSRF from our servers).
 */
export async function fetchUrlTextViaExa(
  rawUrl: string,
  opts: { maxChars: number }
): Promise<FetchUrlExaResult> {
  const safe = assertSafePublicHttpsUrl(rawUrl);

  if (!safe.ok) {
    return { ok: false, error: safe.reason };
  }

  const { contents, error } = await getContents([safe.href]);

  if (error) {
    return { ok: false, error: error.message };
  }
  const first = contents[0];
  const text = (first?.text ?? "").trim();

  if (!text) {
    return {
      ok: false,
      error:
        "No extractable text for this URL (Exa returned empty). Try pasting the text manually.",
    };
  }

  const clipped = text.length > opts.maxChars ? text.slice(0, opts.maxChars) : text;
  let titleHint = safe.hostname;

  try {
    const p = new URL(safe.href).pathname;

    if (p && p !== "/") {
      const seg = p.split("/").filter(Boolean).pop();

      if (seg) titleHint = `${safe.hostname} — ${decodeURIComponent(seg).slice(0, 80)}`;
    }
  } catch {
    /* keep hostname */
  }

  return { ok: true, text: clipped, titleHint };
}

export async function fetchUrlPreviewViaExa(rawUrl: string): Promise<FetchUrlExaResult> {
  return fetchUrlTextViaExa(rawUrl, { maxChars: PREVIEW_MAX });
}

export async function fetchUrlCommitViaExa(rawUrl: string): Promise<FetchUrlExaResult> {
  return fetchUrlTextViaExa(rawUrl, { maxChars: COMMIT_MAX });
}
