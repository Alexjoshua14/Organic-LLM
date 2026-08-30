import { describe, expect, test } from "bun:test";

import {
  ERROR_ID_HEADER,
  SERVER_ERROR_LOG_TAG,
  buildServerErrorReport,
  formatServerErrorLog,
  markErrorReported,
  newErrorId,
  parseServerErrorBody,
  readReportedError,
  serverErrorResponse,
  shouldIncludeErrorDetail,
  summarizeZodIssues,
  toServerErrorBody,
} from "@/lib/observability/server-error";

const baseInput = {
  route: "/api/chat",
  stage: "auth_gate",
  context: { chatId: "thread-1", experience: "arcadia", model: undefined },
};

describe("buildServerErrorReport", () => {
  test("captures name, message, stage and a stack", () => {
    const report = buildServerErrorReport({ ...baseInput, error: new Error("Upstash down") });

    expect(report.name).toBe("Error");
    expect(report.message).toBe("Upstash down");
    expect(report.stage).toBe("auth_gate");
    expect(report.route).toBe("/api/chat");
    expect(report.status).toBe(500);
    expect(report.errorId).toStartWith("err_");
    expect(report.stack).toContain("Error: Upstash down");
  });

  test("drops undefined context keys so log lines stay tight", () => {
    const report = buildServerErrorReport({ ...baseInput, error: new Error("x") });

    expect(report.context).toEqual({ chatId: "thread-1", experience: "arcadia" });
  });

  test("keeps provider status and body from gateway-shaped errors", () => {
    const report = buildServerErrorReport({
      ...baseInput,
      stage: "llm_stream",
      error: {
        name: "APICallError",
        message: "Bad request",
        statusCode: 400,
        url: "https://gateway.example/v1",
        responseBody: '{"error":"unsupported_parameter"}',
      },
    });

    expect(report.statusCode).toBe(400);
    expect(report.url).toBe("https://gateway.example/v1");
    expect(report.responseBody).toContain("unsupported_parameter");
  });
});

describe("formatServerErrorLog", () => {
  test("emits one greppable JSON line", () => {
    const report = buildServerErrorReport({ ...baseInput, error: new Error("boom") });
    const line = formatServerErrorLog(report);

    expect(line).toStartWith(`${SERVER_ERROR_LOG_TAG} `);
    expect(line.includes("\n")).toBe(false);
    expect(JSON.parse(line.slice(SERVER_ERROR_LOG_TAG.length + 1)).errorId).toBe(report.errorId);
  });
});

describe("toServerErrorBody", () => {
  const report = buildServerErrorReport({
    ...baseInput,
    error: new Error("secret internal detail"),
  });

  test("withholds detail from non-privileged callers", () => {
    const body = toServerErrorBody(report, { includeDetail: false });

    expect(body.detail).toBeUndefined();
    expect(body.error).toBe("An unexpected server error occurred");
    // The id and stage are always safe, and are what makes a report findable.
    expect(body.errorId).toBe(report.errorId);
    expect(body.stage).toBe("auth_gate");
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
  });

  test("includes the full report for admins", () => {
    const body = toServerErrorBody(report, { includeDetail: true });

    expect(body.detail?.message).toBe("secret internal detail");
    expect(body.detail?.stack).toBeDefined();
  });
});

describe("serverErrorResponse", () => {
  test("answers with JSON and an error id header, never HTML", async () => {
    const report = buildServerErrorReport({ ...baseInput, error: new Error("boom") });
    const res = serverErrorResponse(report, { includeDetail: false });

    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get(ERROR_ID_HEADER)).toBe(report.errorId);

    const parsed = parseServerErrorBody(await res.json());

    expect(parsed?.errorId).toBe(report.errorId);
  });

  test("honours a public message and status", async () => {
    const report = buildServerErrorReport({
      ...baseInput,
      error: new Error("zod"),
      status: 400,
    });
    const res = serverErrorResponse(report, {
      includeDetail: false,
      publicMessage: "Invalid request body",
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request body");
  });
});

describe("markErrorReported / readReportedError", () => {
  test("round-trips a body so the stream handler doesn't double-report", () => {
    const body = { error: "nope", status: 200, errorId: "err_1", stage: "llm_stream" };
    const error = markErrorReported(new Error("boom"), body);

    expect(readReportedError(error)).toEqual(body);
    expect(readReportedError(new Error("other"))).toBeUndefined();
    expect(readReportedError("string")).toBeUndefined();
  });

  test("the marker is non-enumerable so it never leaks into JSON", () => {
    const error = markErrorReported(new Error("boom"), {
      error: "nope",
      status: 200,
      errorId: "err_1",
      stage: "llm_stream",
    });

    expect(Object.keys(error)).toEqual([]);
  });
});

describe("parseServerErrorBody", () => {
  test("rejects anything without an error id", () => {
    expect(parseServerErrorBody({ error: "boom" })).toBeNull();
    expect(parseServerErrorBody("err_1")).toBeNull();
    expect(parseServerErrorBody(null)).toBeNull();
  });

  test("defaults status and stage when absent", () => {
    const body = parseServerErrorBody({ error: "boom", errorId: "err_1" });

    expect(body).toEqual({ error: "boom", status: 500, errorId: "err_1", stage: "unknown" });
  });
});

describe("shouldIncludeErrorDetail", () => {
  const previous = process.env.ORGANIC_EXPOSE_ERROR_DETAIL;

  test("admins always see detail", () => {
    expect(shouldIncludeErrorDetail(true)).toBe(true);
  });

  test("the explicit opt-in enables it for everyone", () => {
    process.env.ORGANIC_EXPOSE_ERROR_DETAIL = "true";
    expect(shouldIncludeErrorDetail(false)).toBe(true);
    if (previous === undefined) delete process.env.ORGANIC_EXPOSE_ERROR_DETAIL;
    else process.env.ORGANIC_EXPOSE_ERROR_DETAIL = previous;
  });
});

describe("summarizeZodIssues", () => {
  test("names the failing field and code without echoing values", () => {
    const summary = summarizeZodIssues([
      { code: "invalid_type", path: ["message", "parts"], message: "Invalid input" },
      { code: "invalid_value", path: ["experience"], message: "Invalid option" },
    ]);

    expect(summary).toContain("message.parts: invalid_type");
    expect(summary).toContain("experience: invalid_value");
  });

  test("labels root-level issues and caps the list", () => {
    expect(summarizeZodIssues([{ code: "invalid_type", path: [], message: "bad" }])).toContain(
      "<root>"
    );

    const many = Array.from({ length: 15 }, (_, i) => ({
      code: "invalid_type",
      path: [`f${i}`],
      message: "bad",
    }));

    expect(summarizeZodIssues(many)).toContain("+5 more");
    expect(summarizeZodIssues([])).toBe("no issues reported");
  });
});

describe("newErrorId", () => {
  test("is prefixed and unique", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newErrorId()));

    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^err_[0-9a-f]{12}$/);
  });
});
