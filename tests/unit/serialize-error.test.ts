import { describe, expect, test } from "bun:test";

import { serializeError } from "@/lib/llm/log-error";

describe("serializeError", () => {
  test("plain Error", () => {
    const s = serializeError(new Error("boom"));

    expect(s.name).toBe("Error");
    expect(s.message).toBe("boom");
  });

  test("non-Error value", () => {
    const s = serializeError("string fail");

    expect(s.message).toContain("string fail");
  });

  test("reads statusCode and url from loose object", () => {
    const s = serializeError({
      name: "APICallError",
      message: "bad",
      statusCode: 400,
      url: "https://example.com/v1",
      responseBody: '{"error":"x"}',
    });

    expect(s.statusCode).toBe(400);
    expect(s.url).toBe("https://example.com/v1");
    expect(s.responseBody).toContain("error");
  });

  test("object error without message keeps nested details", () => {
    const s = serializeError({
      error: {
        code: "unsupported_parameter",
        param: "include",
        message: "Unsupported include value",
      },
      response: {
        status: 400,
        url: "https://gateway.example/v1/responses",
        body: { error: { code: "unsupported_parameter", param: "include" } },
      },
    });

    expect(s.message).toContain("Unsupported include value");
    expect(s.statusCode).toBe(400);
    expect(s.code).toBe("unsupported_parameter");
    expect(s.url).toContain("gateway.example");
    expect(s.responseBody).toContain("unsupported_parameter");
  });
});
