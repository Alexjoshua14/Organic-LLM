const RESPONSE_BODY_MAX = 2048;

export type SerializedError = {
  name: string;
  message: string;
  cause?: string;
  stack?: string;
  statusCode?: number;
  code?: string;
  url?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  data?: unknown;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;

  return `${s.slice(0, max)}…(truncated)`;
}

function readStringProp(obj: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  const v = obj[key];

  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function readNumberProp(obj: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!obj) return undefined;
  const v = obj[key];

  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  return value as Record<string, unknown>;
}

function readBodyLike(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const rec = asRecord(value);

  if (!rec) return undefined;

  const fromKnown =
    readStringProp(rec, "responseBody") ??
    readStringProp(rec, "responseText") ??
    readStringProp(rec, "body") ??
    readStringProp(rec, "message");

  if (fromKnown) return fromKnown;
  const asJson = safeJson(value);

  return asJson ? truncate(asJson, RESPONSE_BODY_MAX) : undefined;
}

/**
 * JSON-serializable error shape for server logs (AI SDK / gateway / plain Error).
 */
export function serializeError(err: unknown): SerializedError {
  if (err == null) {
    return { name: "UnknownError", message: String(err) };
  }

  const plain = asRecord(err);
  const nestedError = plain ? asRecord(plain.error) : undefined;
  const nestedResponse = plain ? asRecord(plain.response) : undefined;
  const e = err instanceof Error ? err : new Error(String(err));
  const rec = e as Error & Record<string, unknown>;

  const fallbackJson = safeJson(err);
  const explicitMessage =
    readStringProp(nestedError, "message") ??
    readStringProp(plain, "message") ??
    readStringProp(rec, "message");
  const composedMessage =
    explicitMessage || (fallbackJson ? truncate(fallbackJson, RESPONSE_BODY_MAX) : String(err));

  const out: SerializedError = {
    name:
      (readStringProp(rec, "name") ??
        (nestedError ? readStringProp(nestedError, "name") : undefined) ??
        (plain ? readStringProp(plain, "name") : undefined) ??
        e.name) ||
      "Error",
    message: composedMessage,
  };

  if (e.cause !== undefined && e.cause !== null) {
    out.cause =
      e.cause instanceof Error
        ? `${e.cause.name}: ${e.cause.message}`
        : truncate(String(e.cause), 500);
  }

  if (process.env.NODE_ENV === "development" && typeof e.stack === "string") {
    out.stack = truncate(e.stack, 8000);
  }

  const statusCode =
    readNumberProp(rec, "statusCode") ??
    (nestedError ? readNumberProp(nestedError, "statusCode") : undefined) ??
    (nestedResponse ? readNumberProp(nestedResponse, "status") : undefined) ??
    readNumberProp(plain, "statusCode") ??
    readNumberProp(plain, "status");

  if (statusCode !== undefined) out.statusCode = statusCode;

  const code =
    readStringProp(rec, "code") ??
    (nestedError ? readStringProp(nestedError, "code") : undefined) ??
    readStringProp(plain, "code");

  if (code !== undefined) out.code = code;

  const url =
    readStringProp(rec, "url") ??
    (nestedResponse ? readStringProp(nestedResponse, "url") : undefined) ??
    readStringProp(plain, "url");

  if (url !== undefined) out.url = url;

  const responseBody =
    readStringProp(rec, "responseBody") ??
    (nestedError ? readStringProp(nestedError, "responseBody") : undefined) ??
    readStringProp(plain, "responseBody") ??
    readStringProp(rec, "responseText") ??
    readStringProp(plain, "responseText") ??
    (nestedResponse ? readBodyLike(nestedResponse.body) : undefined) ??
    (nestedError ? readBodyLike(nestedError) : undefined);

  if (responseBody !== undefined) {
    out.responseBody = truncate(responseBody, RESPONSE_BODY_MAX);
  }

  const headers = rec.responseHeaders ?? plain?.responseHeaders;

  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const entries: Record<string, string> = {};

    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (typeof v === "string") entries[k] = v;
    }
    if (Object.keys(entries).length > 0) {
      out.responseHeaders = entries;
    }
  }

  const data = rec.data ?? plain?.data;

  if (data !== undefined) {
    const s = safeJson(data);

    if (s !== undefined) out.data = truncate(s, RESPONSE_BODY_MAX);
  }

  return out;
}
