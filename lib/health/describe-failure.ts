import type { HealthCheckResult } from "@/lib/health/types";

type FailureText = Pick<HealthCheckResult, "summary" | "message">;

const MAX_DIAGNOSTIC_CHARS = 160;

const HTML_PATTERN = /^\s*<(?:!doctype|html|head|body)\b|<\/?(?:html|script|noscript|body)\b/i;
const CLOUDFLARE_CHALLENGE_PATTERN = /challenge-platform|cf_chl_opt|Just a moment\.\.\./i;

const NETWORK_ERROR_SUMMARIES: Record<string, string> = {
  ENOTFOUND: "Host not found",
  EAI_AGAIN: "Host not found",
  ECONNREFUSED: "Connection refused",
  ECONNRESET: "Connection reset",
  EHOSTUNREACH: "Host unreachable",
  ENETUNREACH: "Network unreachable",
  ETIMEDOUT: "Request timed out",
  UND_ERR_CONNECT_TIMEOUT: "Request timed out",
  CERT_HAS_EXPIRED: "TLS certificate error",
  DEPTH_ZERO_SELF_SIGNED_CERT: "TLS certificate error",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS certificate error",
};

export function isHtml(text: string): boolean {
  return HTML_PATTERN.test(text);
}

/** Short, single-line diagnostic text, or undefined when it would only be noise (empty or HTML). */
export function safeDiagnostic(text: string | undefined): string | undefined {
  const trimmed = text?.replace(/\s+/g, " ").trim();

  if (!trimmed || isHtml(trimmed)) return undefined;

  return trimmed.length > MAX_DIAGNOSTIC_CHARS
    ? `${trimmed.slice(0, MAX_DIAGNOSTIC_CHARS - 1)}…`
    : trimmed;
}

function httpStatusSummary(status: number): string {
  if (status === 401 || status === 403) return `Access denied (${status})`;
  if (status === 404) return "Health endpoint not found (404)";
  if (status === 429) return "Rate limited (429)";
  if (status >= 500) return `Service error (${status})`;

  return `Unexpected response (${status})`;
}

/** Describes a non-2xx response without echoing its body, which may be a vendor error page. */
export function describeHttpFailure(res: Response, body: string): FailureText {
  if (res.headers.get("cf-mitigated") === "challenge" || CLOUDFLARE_CHALLENGE_PATTERN.test(body)) {
    return {
      summary: `Blocked by Cloudflare challenge (${res.status})`,
      message:
        "Cloudflare is serving a browser challenge to server-side requests. Allow this app's requests through the host's WAF or bot rules.",
    };
  }

  return {
    summary: httpStatusSummary(res.status),
    message: safeDiagnostic(body),
  };
}

function errorCode(error: unknown): string | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };

    if (typeof code === "string") return code;
    current = cause;
  }

  return undefined;
}

/** Describes a thrown error or error message as a short summary plus bounded detail. */
export function describeThrownError(error: unknown): FailureText {
  const raw = error instanceof Error ? error.message : String(error);
  const code = errorCode(error);
  const name = error instanceof Error ? error.name : undefined;

  if (name === "TimeoutError" || name === "AbortError") return { summary: "Request timed out" };

  const known = code ? NETWORK_ERROR_SUMMARIES[code] : undefined;

  if (known) return { summary: known, message: code };

  const detail = safeDiagnostic(raw);

  if (!detail) return { summary: "Unexpected response from service" };

  return {
    summary: detail.length > 80 ? `${detail.slice(0, 77)}…` : detail,
    message: detail,
  };
}
