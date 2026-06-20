import { getContents } from "@/lib/exa/client";

import { assertSafePublicHttpsUrl } from "@/lib/security/external-content/safe-url";
import { fetchExternalContent } from "@/lib/security/external-content/fetch-external-content";

const PREVIEW_MAX = 8000;
const COMMIT_MAX = 120_000;

export type FetchUrlExaResult =
  | { ok: true; text: string; titleHint: string }
  | { ok: false; error: string };

function titleHintFromUrl(href: string, hostname: string): string {
  let titleHint = hostname;

  try {
    const p = new URL(href).pathname;

    if (p && p !== "/") {
      const seg = p.split("/").filter(Boolean).pop();

      if (seg) titleHint = `${hostname} — ${decodeURIComponent(seg).slice(0, 80)}`;
    }
  } catch {
    /* keep hostname */
  }

  return titleHint;
}

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

  const result = await fetchExternalContent({
    url: safe.href,
    options: { mode: "exa-only", maxChars: opts.maxChars, initiatedBy: "user" },
  });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.code === "empty_content"
          ? "No extractable text for this URL (Exa returned empty). Try pasting the text manually."
          : result.reason,
    };
  }

  return {
    ok: true,
    text: result.text,
    titleHint: titleHintFromUrl(safe.href, safe.hostname),
  };
}

export async function fetchUrlPreviewViaExa(rawUrl: string): Promise<FetchUrlExaResult> {
  return fetchUrlTextViaExa(rawUrl, { maxChars: PREVIEW_MAX });
}

export async function fetchUrlCommitViaExa(rawUrl: string): Promise<FetchUrlExaResult> {
  return fetchUrlTextViaExa(rawUrl, { maxChars: COMMIT_MAX });
}
