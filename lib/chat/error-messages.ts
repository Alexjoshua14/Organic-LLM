/**
 * User-facing messages keyed by HTTP status code.
 * When the API includes `status` in the JSON body, the client uses it for lookup; otherwise
 * falls back to MESSAGE_PATTERNS on the body text.
 */
export const CHAT_ERROR_MESSAGES: Partial<Record<number, string>> = {
  400: "Invalid request. Please try again.",
  401: "Please sign in to continue.",
  404: "Account setup incomplete. Please refresh or sign out and back in.",
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
];

/**
 * Map API/LLM errors to user-facing toast copy.
 * Prefers `status` from JSON body when present; else matches message text via MESSAGE_PATTERNS.
 */
export function getChatErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const msg = raw.trim();

  let status: number | undefined;
  try {
    const parsed = JSON.parse(msg) as { status?: number };
    if (parsed && typeof parsed.status === "number") status = parsed.status;
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

  return msg || "Something went wrong. Please try again.";
}
