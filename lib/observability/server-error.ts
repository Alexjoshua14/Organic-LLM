import { serializeError } from "@/lib/llm/log-error";

/**
 * Single grep target for every structured server error we emit. In Vercel (or any
 * log drain) `ORGANIC_SERVER_ERROR` finds the whole set, and each line is one JSON
 * object so it can be piped straight into `jq`.
 */
export const SERVER_ERROR_LOG_TAG = "ORGANIC_SERVER_ERROR";

/** Header echoing the error id so a failure can be traced from the network tab. */
export const ERROR_ID_HEADER = "x-organic-error-id";

/**
 * Where in a request the failure happened. Free-form so new call sites don't need a
 * type change; `CHAT_STAGES` documents the values the chat route uses.
 */
export type ServerErrorStage = string;

/** Stages emitted by `POST /api/chat`, in the order they run. */
export const CHAT_STAGES = {
  parseBody: "parse_body",
  validateBody: "validate_body",
  authGate: "auth_gate",
  modelGate: "model_gate",
  requestSetup: "request_setup",
  persistUserMessage: "persist_user_message",
  loadContext: "load_context",
  systemPrompt: "system_prompt",
  arcadiaShortcut: "arcadia_shortcut",
  compileTools: "compile_tools",
  contextBudget: "context_budget",
  llmStream: "llm_stream",
  streamExecute: "stream_execute",
  streamTransport: "stream_transport",
  resumableStream: "resumable_stream",
} as const;

/** Scalar-only so a report always serializes to one readable log line. */
export type ServerErrorContext = Record<string, string | number | boolean | null | undefined>;

export type ServerErrorReport = {
  errorId: string;
  /** ISO timestamp. */
  at: string;
  /** Route or job that failed, e.g. `/api/chat`. */
  route: string;
  stage: ServerErrorStage;
  /** HTTP status we responded with (200 when the failure happened mid-stream). */
  status: number;
  name: string;
  message: string;
  /** Provider/library error code, when the error carries one. */
  code?: string;
  /** Upstream HTTP status (e.g. the model gateway's), distinct from `status`. */
  statusCode?: number;
  url?: string;
  cause?: string;
  stack?: string;
  responseBody?: string;
  context?: ServerErrorContext;
};

/**
 * Short enough to read out loud or paste into a bug report. Uses the global
 * `crypto` so this module stays importable from client bundles (the client only
 * needs the types and `parseServerErrorBody`).
 */
export function newErrorId(): string {
  return `err_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…(truncated)`;
}

function compactContext(context?: ServerErrorContext): ServerErrorContext | undefined {
  if (!context) return undefined;
  const entries = Object.entries(context).filter(([, v]) => v !== undefined);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export type BuildServerErrorReportInput = {
  error: unknown;
  route: string;
  stage: ServerErrorStage;
  /** Defaults to 500. Pass 200 for mid-stream failures (headers already sent). */
  status?: number;
  /** Reuse an id already handed to the client. */
  errorId?: string;
  context?: ServerErrorContext;
};

/**
 * Normalize any thrown value into the shape we log and (for admins) return.
 *
 * Unlike `serializeError`, the stack is always captured: the whole point of a
 * report is that an operator can read it in production.
 */
export function buildServerErrorReport(input: BuildServerErrorReportInput): ServerErrorReport {
  const { error, route, stage, status = 500, context } = input;
  const serialized = serializeError(error);
  const stack = error instanceof Error && typeof error.stack === "string" ? error.stack : undefined;

  return {
    errorId: input.errorId ?? newErrorId(),
    at: new Date().toISOString(),
    route,
    stage,
    status,
    name: serialized.name,
    message: truncate(serialized.message, 2000),
    code: serialized.code,
    statusCode: serialized.statusCode,
    url: serialized.url,
    cause: serialized.cause,
    stack: stack ? truncate(stack, 8000) : serialized.stack,
    responseBody: serialized.responseBody,
    context: compactContext(context),
  };
}

/** One JSON line, prefixed with the grep tag. */
export function formatServerErrorLog(report: ServerErrorReport): string {
  return `${SERVER_ERROR_LOG_TAG} ${JSON.stringify(report)}`;
}

/**
 * JSON body returned to the client for a failed request. `status` mirrors the HTTP
 * status so the existing client status→copy lookup keeps working, and `errorId`
 * ties the toast to a log line. `detail` is present only for privileged viewers.
 */
export type ServerErrorBody = {
  error: string;
  status: number;
  errorId: string;
  stage: ServerErrorStage;
  detail?: ServerErrorReport;
};

export const GENERIC_SERVER_ERROR_MESSAGE = "An unexpected server error occurred";

/** Where a listing of recent errors came from. */
export type ServerErrorLogSource = "redis" | "memory";

export function toServerErrorBody(
  report: ServerErrorReport,
  options: { publicMessage?: string; includeDetail: boolean }
): ServerErrorBody {
  return {
    error: options.publicMessage ?? GENERIC_SERVER_ERROR_MESSAGE,
    status: report.status,
    errorId: report.errorId,
    stage: report.stage,
    ...(options.includeDetail ? { detail: report } : {}),
  };
}

/**
 * Always JSON, never an HTML error page: an opaque `<!DOCTYPE html>` 500 is what
 * makes these failures undebuggable from the browser.
 */
export function serverErrorResponse(
  report: ServerErrorReport,
  options: { publicMessage?: string; includeDetail: boolean }
): Response {
  return new Response(JSON.stringify(toServerErrorBody(report, options)), {
    status: report.status,
    headers: {
      "Content-Type": "application/json",
      [ERROR_ID_HEADER]: report.errorId,
    },
  });
}

const REPORTED_BODY = Symbol.for("organic-llm.reportedErrorBody");

/** Tag an error that has already been reported so re-entrant handlers don't double-log. */
export function markErrorReported<E>(error: E, body: ServerErrorBody): E {
  try {
    Object.defineProperty(error as object, REPORTED_BODY, {
      value: body,
      enumerable: false,
      configurable: true,
    });
  } catch {
    /* frozen or primitive throw values simply don't carry the tag */
  }

  return error;
}

export function readReportedError(error: unknown): ServerErrorBody | undefined {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return undefined;
  const body = (error as Record<symbol, unknown>)[REPORTED_BODY];

  return body && typeof body === "object" ? (body as ServerErrorBody) : undefined;
}

/**
 * Whether this viewer may see `detail`. Admins always; everyone in a non-production
 * build; and `ORGANIC_EXPOSE_ERROR_DETAIL=true` as a deliberate escape hatch for a
 * preview deployment where no profile is flagged admin yet.
 */
export function shouldIncludeErrorDetail(isAdmin: boolean | undefined): boolean {
  if (isAdmin) return true;
  if (process.env.ORGANIC_EXPOSE_ERROR_DETAIL === "true") return true;

  return process.env.NODE_ENV !== "production";
}

/**
 * Recognize a `ServerErrorBody` in an already-parsed JSON value. Used by the client
 * to tell our structured failures apart from arbitrary error text.
 */
export function parseServerErrorBody(value: unknown): ServerErrorBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;

  if (typeof rec.errorId !== "string" || typeof rec.error !== "string") return null;

  return {
    error: rec.error,
    status: typeof rec.status === "number" ? rec.status : 500,
    errorId: rec.errorId,
    stage: typeof rec.stage === "string" ? rec.stage : "unknown",
    ...(rec.detail && typeof rec.detail === "object"
      ? { detail: rec.detail as ServerErrorReport }
      : {}),
  };
}

/** Structural view of a Zod issue so this module stays free of a zod import. */
type ZodIssueLike = {
  code?: string;
  path?: ReadonlyArray<PropertyKey>;
  message?: string;
};

/**
 * Collapse Zod issues into one log-safe line: field path + issue code + Zod's message.
 * Field *values* are never echoed, so message content stays out of the logs.
 */
export function summarizeZodIssues(issues: ReadonlyArray<ZodIssueLike>, max = 10): string {
  if (issues.length === 0) return "no issues reported";

  const shown = issues
    .slice(0, max)
    .map((issue) => {
      const path = (issue.path ?? []).map(String).join(".") || "<root>";

      return `${path}: ${issue.code ?? "invalid"} (${issue.message ?? "invalid value"})`;
    })
    .join("; ");

  return issues.length > max ? `${shown}; +${issues.length - max} more` : shown;
}
