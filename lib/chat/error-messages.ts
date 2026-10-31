import { JEV_INPUT_TOO_LARGE_MESSAGE } from "@/lib/arcadia/jev/constants";
import { formatResetCountdown } from "@/lib/plans/budget-cycle";

/**
 * User-facing messages keyed by HTTP status code.
 * When the API includes `status` in the JSON body, the client uses it for lookup; otherwise
 * falls back to MESSAGE_PATTERNS on the body text.
 */
export const CHAT_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: "Invalid request. Please try again.",
  401: "Please sign in to continue.",
  404: "Account setup incomplete. Please refresh or sign out and back in.",
  413: JEV_INPUT_TOO_LARGE_MESSAGE,
  429: "Rate limit reached. Please wait a moment before sending again.",
};

/** Message text patterns that map response body text to a status for message lookup. */
const MESSAGE_PATTERNS: { patterns: string[]; status: number }[] = [
  {
    patterns: ["Too many LLM requests", "Too many requests"],
    status: 429,
  },
  { patterns: ["Token usage limit exceeded"], status: 429 },
  { patterns: ["Cost limit exceeded"], status: 429 },
  { patterns: ["Unauthorized"], status: 401 },
  { patterns: ["User not found in supabase"], status: 404 },
  { patterns: ["Invalid request body"], status: 400 },
  // The hosting platform rejects oversized bodies before the route runs, so these arrive as its
  // plain-text error page rather than our JSON.
  {
    patterns: ["FUNCTION_PAYLOAD_TOO_LARGE", "Request Entity Too Large", "Payload Too Large"],
    status: 413,
  },
];

/** Reads `status` and a non-blank string `error` from a JSON error body; ignores anything else. */
function parseErrorBody(msg: string): { status?: number; error?: string } {
  try {
    const parsed: unknown = JSON.parse(msg);

    if (!parsed || typeof parsed !== "object") return {};

    const body = parsed as { status?: unknown; error?: unknown };
    const error = typeof body.error === "string" ? body.error.trim() : "";

    return {
      status: typeof body.status === "number" ? body.status : undefined,
      error: error || undefined,
    };
  } catch {
    // not JSON, fall through to pattern matching
    return {};
  }
}

/**
 * Map API/LLM errors to user-facing toast copy.
 * Prefers `status` from JSON body when present; else matches message text via MESSAGE_PATTERNS.
 * A JSON body whose status has no copy here (e.g. 409 on a stale Jev override) shows its own
 * `error` text, which the route writes for users, instead of the raw JSON.
 */
export function getChatErrorMessage(error: unknown, now: Date = new Date()): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const msg = raw.trim();
  const body = parseErrorBody(msg);

  let status: number | undefined;

  try {
    const parsed = JSON.parse(msg) as {
      status?: number;
      code?: string;
      error?: string;
      resetAt?: string;
      resetsRemaining?: number | null;
    };

    if (parsed && typeof parsed.status === "number") status = parsed.status;
    if (parsed?.code === "plan_limit") return planLimitMessage(parsed, now);
  } catch {
    // not JSON, fall through to pattern matching
  }
  if (status !== undefined && status in CHAT_ERROR_MESSAGES) {
    return CHAT_ERROR_MESSAGES[status]!;
  }

  for (const { patterns, status: s } of MESSAGE_PATTERNS) {
    if (patterns.some((p) => msg.includes(p))) {
      const text = CHAT_ERROR_MESSAGES[s];

      if (text) return text;
    }
  }

  return body.error ?? (msg || "Something went wrong. Please try again.");
}

/** A spent weekly plan budget: why, when it resets, and whether a reset is available. */
function planLimitMessage(
  body: { error?: string; resetAt?: string; resetsRemaining?: number | null },
  now: Date
): string {
  const parts = [body.error?.trim() || "You've reached this week's plan limit."];
  const resetAt = body.resetAt ? Date.parse(body.resetAt) : Number.NaN;

  if (Number.isFinite(resetAt))
    parts.push(`It resets in ${formatResetCountdown(resetAt - now.getTime())}.`);
  if (typeof body.resetsRemaining === "number" && body.resetsRemaining > 0) {
    parts.push(
      `You can start a fresh window now from Usage (${body.resetsRemaining} reset${body.resetsRemaining === 1 ? "" : "s"} left).`
    );
  }

  return parts.join(" ");
}
