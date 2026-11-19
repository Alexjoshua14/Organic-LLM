/**
 * Agent test accounts: signed-in accounts that AI coding agents use to try Organic. They get
 * the hidden `agent` plan (lib/usage/plans.ts), a whole-account request throttle in `proxy.ts`
 * (lib/rate-limit/agent-account.ts), no voice, and access to unfinished surfaces (labs).
 *
 * Assigned only by env, so a mistake can only make an account more limited. Never put a Clerk
 * id in source: this repository is public. Imported by `proxy.ts`, so no `server-only`.
 */

/** Comma-separated Clerk user ids. Unset in normal operation; set it where agents sign in. */
export const AGENT_TEST_CLERK_USER_IDS_ENV = "AGENT_TEST_CLERK_USER_IDS";

let cached: { raw: string | undefined; ids: Set<string> } | null = null;

/** Parsed once per distinct value: `proxy.ts` calls this on every signed-in request. */
export function parseAgentClerkUserIds(
  raw: string | undefined = process.env[AGENT_TEST_CLERK_USER_IDS_ENV]
): Set<string> {
  if (cached && cached.raw === raw) return cached.ids;
  const ids =
    !raw || !raw.trim()
      ? new Set<string>()
      : new Set(
          raw
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        );

  cached = { raw, ids };

  return ids;
}

/** True when this deployment has any agent test account configured. */
export function hasAgentAccounts(raw?: string): boolean {
  return parseAgentClerkUserIds(raw).size > 0;
}

export function isAgentAccount(clerkUserId: string | null | undefined, raw?: string): boolean {
  if (!clerkUserId) return false;

  return parseAgentClerkUserIds(raw).has(clerkUserId);
}

/**
 * Routes an agent account may never call. Voice is the most expensive spend, part of its cost
 * (transcription) is outside the usage ledger, and an agent cannot listen to it anyway.
 */
export const AGENT_DENIED_PATH_PREFIXES = [
  "/api/ai/speak/realtime/session",
  "/api/ai/tts",
  "/api/ai/tts-v2",
] as const;

export function isAgentDeniedPath(pathname: string): boolean {
  return AGENT_DENIED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Anything that can change state or spend: every non-safe method, server actions included. */
export function isAgentWriteRequest(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}
