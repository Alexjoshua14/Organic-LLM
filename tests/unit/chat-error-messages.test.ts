import { describe, expect, test } from "bun:test";

import {
  chatErrorInfoFromServerBody,
  extractNextErrorDigest,
  getChatErrorMessage,
  looksLikeHtmlErrorPage,
  parseChatError,
} from "@/lib/chat/error-messages";

/** Tail of a real Next.js production error document, as the AI SDK hands it to us. */
const NEXT_ERROR_PAGE = `<!DOCTYPE html><html><body><script>self.__next_f.push([1,"3:[\\"$\\",\\"div\\",null,{\\"children\\":\\"A server error occurred. Reload to try again.\\"}]\\n"])</script><script>self.__next_f.push([1,"{\\"digest\\":\\"2871049183\\"}"])</script></body></html>`;

describe("parseChatError", () => {
  test("keeps an HTML error page out of the user-facing message", () => {
    const info = parseChatError(new Error(NEXT_ERROR_PAGE));

    expect(info.isHtmlErrorPage).toBe(true);
    expect(info.message).not.toContain("<");
    expect(info.message.length).toBeLessThan(200);
    expect(info.status).toBe(500);
  });

  test("surfaces the Next.js digest so it can be grepped in server logs", () => {
    const info = parseChatError(new Error(NEXT_ERROR_PAGE));

    expect(info.nextDigest).toBe("2871049183");
    expect(info.message).toContain("2871049183");
  });

  test("keeps the raw body for the diagnostics panel but bounds it", () => {
    const info = parseChatError(new Error(`${NEXT_ERROR_PAGE}${"x".repeat(20000)}`));

    expect(info.raw).toBeDefined();
    expect(info.raw!.length).toBeLessThanOrEqual(4001);
  });

  test("reads our structured server error body", () => {
    const info = parseChatError(
      new Error(
        JSON.stringify({
          error: "An unexpected server error occurred",
          status: 500,
          errorId: "err_abc123def456",
          stage: "auth_gate",
          detail: {
            errorId: "err_abc123def456",
            at: "2026-08-30T00:00:00.000Z",
            route: "/api/chat",
            stage: "auth_gate",
            status: 500,
            name: "Error",
            message: "Upstash request failed",
          },
        })
      )
    );

    expect(info.errorId).toBe("err_abc123def456");
    expect(info.stage).toBe("auth_gate");
    expect(info.status).toBe(500);
    expect(info.detail?.message).toBe("Upstash request failed");
    expect(info.isHtmlErrorPage).toBe(false);
  });

  test("still maps legacy status bodies to friendly copy", () => {
    expect(getChatErrorMessage(new Error(JSON.stringify({ error: "Unauthorized", status: 401 })))).toBe(
      "Please sign in to continue."
    );
    expect(getChatErrorMessage(new Error(JSON.stringify({ error: "Too many requests", status: 429 })))).toBe(
      "Rate limit reached. Please wait a moment before sending again."
    );
  });

  test("still matches known plain-text messages", () => {
    expect(getChatErrorMessage("Too many LLM requests")).toBe(
      "Rate limit reached. Please wait a moment before sending again."
    );
    expect(getChatErrorMessage("User not found in supabase")).toBe(
      "Account setup incomplete. Please refresh or sign out and back in."
    );
  });

  test("truncates unrecognized long text instead of dumping it", () => {
    const info = parseChatError(new Error("y".repeat(5000)));

    expect(info.message.length).toBeLessThanOrEqual(201);
  });

  test("falls back to generic copy for an empty error", () => {
    expect(getChatErrorMessage(new Error(""))).toBe("Something went wrong. Please try again.");
    expect(getChatErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});

describe("looksLikeHtmlErrorPage", () => {
  test("detects documents and RSC flight payloads", () => {
    expect(looksLikeHtmlErrorPage(NEXT_ERROR_PAGE)).toBe(true);
    expect(looksLikeHtmlErrorPage('{"error":"nope"}')).toBe(false);
  });
});

describe("extractNextErrorDigest", () => {
  test("reads both escaped and plain digest forms", () => {
    expect(extractNextErrorDigest('{\\"digest\\":\\"1234567890\\"}')).toBe("1234567890");
    expect(extractNextErrorDigest('{"digest":"abcdef12"}')).toBe("abcdef12");
    expect(extractNextErrorDigest("no digest here")).toBeUndefined();
  });
});

describe("chatErrorInfoFromServerBody", () => {
  test("carries stage, id and detail through to the panel", () => {
    const info = chatErrorInfoFromServerBody({
      error: "An unexpected server error occurred",
      status: 200,
      errorId: "err_deadbeef0001",
      stage: "llm_stream",
    });

    expect(info.errorId).toBe("err_deadbeef0001");
    expect(info.stage).toBe("llm_stream");
    expect(info.isHtmlErrorPage).toBe(false);
  });
});
