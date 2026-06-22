import "server-only";

import { getContents } from "@/lib/exa/client";
import { createLogger } from "@/lib/logger";

import {
  requiresModelFetchConfirmation,
  verifyFetchConfirmation,
} from "./confirm";
import { extractReadableText } from "./extract-text";
import { safeFetch } from "./safe-fetch";
import type {
  ConfirmedFetchToken,
  ExternalContentFetchMode,
  ExternalContentInitiator,
  FetchExternalContentOptions,
  FetchExternalContentResult,
} from "./types";
import { assertSafePublicHttpsUrl } from "./safe-url";

const logger = createLogger("lib/security/external-content/fetch-external-content");

const DEFAULT_MAX_CHARS = 5000;

export type FetchExternalContentParams = {
  url: string;
  options?: FetchExternalContentOptions;
};

async function fetchViaExa(
  url: string,
  maxChars: number
): Promise<FetchExternalContentResult | null> {
  const safe = assertSafePublicHttpsUrl(url);

  if (!safe.ok) {
    return { ok: false, reason: safe.reason, code: "unsafe_url" };
  }

  const { contents, error } = await getContents([safe.href]);

  if (error) {
    logger.log("fetchViaExa", `Exa failed for ${safe.href}: ${error.message}`);

    return null;
  }

  const text = (contents[0]?.text ?? "").trim();

  if (!text) {
    return null;
  }

  const extracted = extractReadableText(text, { maxChars, contentType: "text/plain" });

  return {
    ok: true,
    text: extracted.text,
    finalUrl: safe.href,
    source: "exa",
    truncated: extracted.truncated,
  };
}

async function fetchViaOrigin(
  url: string,
  maxChars: number
): Promise<FetchExternalContentResult> {
  const fetched = await safeFetch(url);

  if (!fetched.ok) {
    return {
      ok: false,
      reason: fetched.reason,
      code: fetched.code,
    };
  }

  const extracted = extractReadableText(fetched.body, {
    maxChars,
    contentType: fetched.contentType,
  });

  if (!extracted.text) {
    return { ok: false, reason: "No extractable text content", code: "empty_content" };
  }

  return {
    ok: true,
    text: extracted.text,
    finalUrl: fetched.finalUrl,
    source: "origin",
    truncated: extracted.truncated,
  };
}

function gateModelDirectFetch(
  mode: ExternalContentFetchMode,
  initiatedBy: ExternalContentInitiator,
  url: string,
  confirmation?: ConfirmedFetchToken
): FetchExternalContentResult | null {
  if (!requiresModelFetchConfirmation(mode, initiatedBy)) {
    return null;
  }

  const verified = verifyFetchConfirmation(confirmation, url);

  if (!verified.ok) {
    return {
      ok: false,
      reason: verified.reason,
      code: confirmation ? "confirmation_invalid" : "confirmation_required",
    };
  }

  return null;
}

/**
 * Single entry point for fetching external web content through the DMZ.
 */
export async function fetchExternalContent({
  url,
  options = {},
}: FetchExternalContentParams): Promise<FetchExternalContentResult> {
  const mode: ExternalContentFetchMode = options.mode ?? "auto";
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const initiatedBy: ExternalContentInitiator = options.initiatedBy ?? "server";

  const confirmationGate = gateModelDirectFetch(mode, initiatedBy, url, options.confirmation);

  if (confirmationGate) {
    return confirmationGate;
  }

  const targetUrl =
    mode === "direct" && initiatedBy === "model" && options.confirmation
      ? options.confirmation.url
      : url;

  if (mode === "exa-only") {
    const exaResult = await fetchViaExa(targetUrl, maxChars);

    return (
      exaResult ?? {
        ok: false,
        reason: "No extractable text from Exa",
        code: "empty_content",
      }
    );
  }

  if (mode === "direct") {
    return fetchViaOrigin(targetUrl, maxChars);
  }

  // auto: Exa first, origin fallback
  const exaResult = await fetchViaExa(targetUrl, maxChars);

  if (exaResult?.ok) {
    return exaResult;
  }

  if (exaResult && !exaResult.ok && exaResult.code === "unsafe_url") {
    return exaResult;
  }

  logger.log("fetchExternalContent", `Falling back to origin fetch for ${targetUrl}`);

  return fetchViaOrigin(targetUrl, maxChars);
}

/**
 * Convenience wrapper returning plain text or empty string (rabbit-hole analyzeSource compat).
 */
export async function fetchExternalContentText(
  url: string,
  options?: FetchExternalContentOptions
): Promise<string> {
  const result = await fetchExternalContent({ url, options });

  if (!result.ok) {
    logger.log("fetchExternalContentText", `Fetch failed (${result.code}): ${result.reason}`);

    return "";
  }

  return result.text;
}
