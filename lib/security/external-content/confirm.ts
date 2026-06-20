import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { ConfirmedFetchToken, ExternalContentFetchMode, ExternalContentInitiator, FetchConfirmationRequest } from "./types";
import { assertSafePublicHttpsUrl } from "./safe-url";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function getConfirmSecret(): string | null {
  return (
    process.env.EXTERNAL_FETCH_CONFIRM_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    null
  );
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function canonicalUrl(url: string): string {
  const safe = assertSafePublicHttpsUrl(url);

  return safe.ok ? safe.href : url.trim();
}

export function buildFetchConfirmationRequest(
  url: string,
  reason?: string
): FetchConfirmationRequest | { ok: false; reason: string } {
  const safe = assertSafePublicHttpsUrl(url);

  if (!safe.ok) {
    return { ok: false, reason: safe.reason };
  }

  return {
    url: safe.href,
    hostname: safe.hostname,
    reason,
  };
}

/**
 * Issue a short-lived confirmation token for model-initiated direct fetches.
 * Intended for a future approval endpoint / human-in-the-loop tool flow.
 */
export function createConfirmedFetchToken(
  url: string,
  opts: { ttlMs?: number } = {}
): ConfirmedFetchToken | { ok: false; reason: string } {
  const secret = getConfirmSecret();

  if (!secret) {
    return { ok: false, reason: "Confirmation secret is not configured" };
  }

  const safe = assertSafePublicHttpsUrl(url);

  if (!safe.ok) {
    return { ok: false, reason: safe.reason };
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + (opts.ttlMs ?? DEFAULT_TTL_MS);
  const nonce = randomBytes(16).toString("hex");
  const payload = `${safe.href}|${issuedAt}|${expiresAt}|${nonce}`;
  const signature = signPayload(payload, secret);

  return {
    url: safe.href,
    issuedAt,
    nonce,
    expiresAt,
    signature,
  };
}

export type VerifyFetchConfirmationResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * Fail-closed verification for model-initiated direct fetches.
 */
export function verifyFetchConfirmation(
  token: ConfirmedFetchToken | undefined,
  requestedUrl: string
): VerifyFetchConfirmationResult {
  if (!token) {
    return { ok: false, reason: "User confirmation is required for model-initiated URL fetch" };
  }

  const secret = getConfirmSecret();

  if (!secret) {
    return { ok: false, reason: "Confirmation secret is not configured" };
  }

  const expectedUrl = canonicalUrl(requestedUrl);
  const tokenUrl = canonicalUrl(token.url);

  if (expectedUrl !== tokenUrl) {
    return { ok: false, reason: "Confirmation token URL mismatch" };
  }

  if (Date.now() > token.expiresAt) {
    return { ok: false, reason: "Confirmation token expired" };
  }

  const payload = `${tokenUrl}|${token.issuedAt}|${token.expiresAt}|${token.nonce}`;
  const expectedSig = signPayload(payload, secret);

  try {
    const a = Uint8Array.from(Buffer.from(expectedSig, "base64url"));
    const b = Uint8Array.from(Buffer.from(token.signature, "base64url"));

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Confirmation token signature invalid" };
    }
  } catch {
    return { ok: false, reason: "Confirmation token signature invalid" };
  }

  return { ok: true, url: tokenUrl };
}

export function requiresModelFetchConfirmation(
  mode: ExternalContentFetchMode,
  initiatedBy: ExternalContentInitiator
): boolean {
  return mode === "direct" && initiatedBy === "model";
}
