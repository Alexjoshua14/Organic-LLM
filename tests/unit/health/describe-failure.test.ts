import { describe, expect, test } from "bun:test";

import {
  describeHttpFailure,
  describeThrownError,
  safeDiagnostic,
} from "@/lib/health/describe-failure";

const CLOUDFLARE_PAGE =
  '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body>' +
  '<span id="challenge-error-text">Enable JavaScript and cookies to continue</span>' +
  "<script>window._cf_chl_opt = {cOgUHash: 'abc'};</script></body></html>";

describe("describeHttpFailure", () => {
  test("names a Cloudflare challenge and drops the page", () => {
    const res = new Response(CLOUDFLARE_PAGE, { status: 403 });
    const result = describeHttpFailure(res, CLOUDFLARE_PAGE);

    expect(result.summary).toBe("Blocked by Cloudflare challenge (403)");
    expect(result.message).not.toContain("<");
    expect(result.message).not.toContain("_cf_chl_opt");
  });

  test("recognises the cf-mitigated header without a body match", () => {
    const res = new Response("", { status: 403, headers: { "cf-mitigated": "challenge" } });

    expect(describeHttpFailure(res, "").summary).toContain("Cloudflare");
  });

  test("omits any other HTML error page", () => {
    const body = "<html><body><h1>502 Bad Gateway</h1></body></html>";
    const result = describeHttpFailure(new Response(body, { status: 502 }), body);

    expect(result.summary).toBe("Service error (502)");
    expect(result.message).toBeUndefined();
  });

  test("keeps a short plain-text body as detail", () => {
    const result = describeHttpFailure(new Response("unavailable", { status: 503 }), "unavailable");

    expect(result.summary).toBe("Service error (503)");
    expect(result.message).toBe("unavailable");
  });

  test("labels credential rejections", () => {
    expect(describeHttpFailure(new Response("", { status: 401 }), "").summary).toBe(
      "Access denied (401)"
    );
  });
});

describe("describeThrownError", () => {
  test("maps a DNS failure nested in a fetch error cause", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND memory.example.com"), {
        code: "ENOTFOUND",
      }),
    });

    expect(describeThrownError(error)).toEqual({ summary: "Host not found", message: "ENOTFOUND" });
  });

  test("treats abort and timeout errors as a timeout", () => {
    const error = new DOMException("The operation timed out.", "TimeoutError");

    expect(describeThrownError(error).summary).toBe("Request timed out");
  });

  test("never surfaces an HTML error message", () => {
    expect(describeThrownError(new Error(CLOUDFLARE_PAGE))).toEqual({
      summary: "Unexpected response from service",
    });
  });

  test("truncates a long plain message", () => {
    const result = describeThrownError(new Error("x".repeat(500)));

    expect(result.summary.length).toBeLessThanOrEqual(80);
    expect(result.message?.length).toBeLessThanOrEqual(160);
  });
});

describe("safeDiagnostic", () => {
  test("collapses whitespace and returns undefined for empty input", () => {
    expect(safeDiagnostic("a \n  b")).toBe("a b");
    expect(safeDiagnostic("   ")).toBeUndefined();
    expect(safeDiagnostic(undefined)).toBeUndefined();
  });
});
