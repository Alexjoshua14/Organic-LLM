import { JEV_INPUT_TOO_LARGE_MESSAGE } from "@/lib/arcadia/jev/constants";

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
export function getChatErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const msg = raw.trim();
  const body = parseErrorBody(msg);

  if (body.status !== undefined && body.status in CHAT_ERROR_MESSAGES) {
    return CHAT_ERROR_MESSAGES[body.status]!;
  }

  for (const { patterns, status: s } of MESSAGE_PATTERNS) {
    if (patterns.some((p) => msg.includes(p))) {
      const text = CHAT_ERROR_MESSAGES[s];

      if (text) return text;
    }
  }

  return body.error ?? (msg || "Something went wrong. Please try again.");
}
