import {
  parseServerErrorBody,
  type ServerErrorBody,
  type ServerErrorReport,
} from "@/lib/observability/server-error";

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
  500: "The server hit an error handling this message.",
  502: "The server hit an error handling this message.",
  503: "The service is temporarily unavailable. Please try again.",
  504: "The request timed out before the model responded.",
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

export const DEFAULT_CHAT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Toast copy must stay readable; anything longer belongs in the diagnostics panel. */
const MAX_TOAST_MESSAGE_LENGTH = 200;

/** Raw bodies are kept for the diagnostics panel, but never unbounded. */
const MAX_RAW_LENGTH = 4000;

export type ChatErrorInfo = {
  /** Short copy safe to show in a toast. Never an HTML document. */
  message: string;
  /** HTTP status, when we could determine one. */
  status?: number;
  /** Server-issued id — matches the `ORGANIC_SERVER_ERROR` log line and /admin/errors. */
  errorId?: string;
  /** Which step of the request failed (`auth_gate`, `load_context`, `llm_stream`, …). */
  stage?: string;
  /** Full server-side report; only sent to admins (and in dev). */
  detail?: ServerErrorReport;
  /** True when the response body was an HTML page rather than JSON. */
  isHtmlErrorPage: boolean;
  /** Next.js error digest scraped from an HTML error page; greppable in server logs. */
  nextDigest?: string;
  /** Raw body/message, truncated. For the diagnostics panel only. */
  raw?: string;
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/**
 * A framework/proxy error page reached the client instead of JSON. Detected by shape
 * rather than content-type because by the time the AI SDK throws, all we have is text.
 */
export function looksLikeHtmlErrorPage(text: string): boolean {
  const head = text.slice(0, 4000).toLowerCase();

  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    text.includes("self.__next_f.push") ||
    text.includes("A server error occurred")
  );
}

/**
 * Next.js stamps a `digest` on production server errors and prints the same value
 * next to the stack in the server logs, so it's the one usable handle on an
 * otherwise opaque HTML 500.
 */
export function extractNextErrorDigest(text: string): string | undefined {
  const match = text.match(/\\?"digest\\?"\s*:\s*\\?"([^"\\]{4,64})\\?"/);

  return match?.[1];
}

function statusFromPatterns(text: string): number | undefined {
  for (const { patterns, status } of MESSAGE_PATTERNS) {
    if (patterns.some((p) => text.includes(p))) return status;
  }

  return undefined;
}

function rawTextFrom(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") return message;
  }

  return "";
}

/**
 * Turn whatever `useChat` handed us into something a human can act on.
 *
 * The AI SDK rejects with the raw response body as the error message, so a 500 that
 * rendered an HTML error page used to end up dumped verbatim into a toast. Anything
 * unrecognized is truncated rather than shown whole.
 */
export function parseChatError(error: unknown): ChatErrorInfo {
  const raw = rawTextFrom(error).trim();

  if (!raw) {
    return { message: DEFAULT_CHAT_ERROR_MESSAGE, isHtmlErrorPage: false };
  }

  // 1. Our own structured payload (JSON body, or the JSON we stream in an error chunk).
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch {
    parsedJson = undefined;
  }

  const serverBody = parseServerErrorBody(parsedJson);

  if (serverBody) {
    const statusCopy = CHAT_ERROR_MESSAGES[serverBody.status];

    return {
      message: truncate(statusCopy ?? serverBody.error, MAX_TOAST_MESSAGE_LENGTH),
      status: serverBody.status,
      errorId: serverBody.errorId,
      stage: serverBody.stage,
      detail: serverBody.detail,
      isHtmlErrorPage: false,
      raw: truncate(raw, MAX_RAW_LENGTH),
    };
  }

  // 2. Legacy `{ error, status }` bodies from routes not yet migrated.
  if (parsedJson && typeof parsedJson === "object") {
    const rec = parsedJson as { status?: unknown; error?: unknown };
    const status = typeof rec.status === "number" ? rec.status : undefined;
    const text = typeof rec.error === "string" ? rec.error : undefined;

    if (status !== undefined || text !== undefined) {
      const resolvedStatus = status ?? (text ? statusFromPatterns(text) : undefined);

      return {
        message: truncate(
          (resolvedStatus !== undefined ? CHAT_ERROR_MESSAGES[resolvedStatus] : undefined) ??
            text ??
            DEFAULT_CHAT_ERROR_MESSAGE,
          MAX_TOAST_MESSAGE_LENGTH
        ),
        status: resolvedStatus,
        isHtmlErrorPage: false,
        raw: truncate(raw, MAX_RAW_LENGTH),
      };
    }
  }

  // 3. An HTML error page (framework 500, proxy/gateway page). Say so plainly instead
  //    of pasting the document into the UI.
  if (looksLikeHtmlErrorPage(raw)) {
    const digest = extractNextErrorDigest(raw);

    return {
      message: digest
        ? `The server returned an error page instead of a response (Next.js digest ${digest}). Check the server logs.`
        : "The server returned an error page instead of a response. Check the server logs.",
      status: 500,
      isHtmlErrorPage: true,
      nextDigest: digest,
      raw: truncate(raw, MAX_RAW_LENGTH),
    };
  }

  // 4. Plain text — map known phrases, otherwise show it (bounded).
  const status = statusFromPatterns(raw);
  const statusCopy = status !== undefined ? CHAT_ERROR_MESSAGES[status] : undefined;

  return {
    message: truncate(statusCopy ?? raw, MAX_TOAST_MESSAGE_LENGTH),
    status,
    isHtmlErrorPage: false,
    raw: truncate(raw, MAX_RAW_LENGTH),
  };
}

/**
 * Map API/LLM errors to user-facing toast copy.
 * Prefers `status` from JSON body when present; else matches message text via MESSAGE_PATTERNS.
 */
export function getChatErrorMessage(error: unknown): string {
  return parseChatError(error).message;
}

/**
 * Build the panel/toast shape from a structured body the server streamed in-band
 * (a `data-error` part), which is how mid-stream failures reach the client once the
 * response headers are already out.
 */
export function chatErrorInfoFromServerBody(body: ServerErrorBody): ChatErrorInfo {
  return {
    message: truncate(CHAT_ERROR_MESSAGES[body.status] ?? body.error, MAX_TOAST_MESSAGE_LENGTH),
    status: body.status,
    errorId: body.errorId,
    stage: body.stage,
    detail: body.detail,
    isHtmlErrorPage: false,
  };
}
