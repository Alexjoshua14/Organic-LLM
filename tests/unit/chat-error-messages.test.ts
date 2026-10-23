import { describe, expect, test } from "bun:test";

import { JEV_INPUT_TOO_LARGE_MESSAGE } from "@/lib/arcadia/jev/constants";
import { CHAT_ERROR_MESSAGES, getChatErrorMessage } from "@/lib/chat/error-messages";

const FALLBACK = "Something went wrong. Please try again.";

/** What the AI SDK transport throws on a non-OK response: the body text as the message. */
function bodyError(body: unknown): Error {
  return new Error(typeof body === "string" ? body : JSON.stringify(body));
}

describe("getChatErrorMessage", () => {
  test("maps a JSON status to its copy", () => {
    expect(getChatErrorMessage(bodyError({ error: "Unauthorized", status: 401 }))).toBe(
      CHAT_ERROR_MESSAGES[401]!
    );
    expect(getChatErrorMessage(bodyError({ error: "Invalid JSON", status: 400 }))).toBe(
      CHAT_ERROR_MESSAGES[400]!
    );
  });

  test("413 from the chat route shows the too-large copy", () => {
    expect(
      getChatErrorMessage(bodyError({ error: JEV_INPUT_TOO_LARGE_MESSAGE, status: 413 }))
    ).toBe(JEV_INPUT_TOO_LARGE_MESSAGE);
    // The status alone is enough; the copy does not depend on the server's wording.
    expect(getChatErrorMessage(bodyError({ error: "Too big", status: 413 }))).toBe(
      JEV_INPUT_TOO_LARGE_MESSAGE
    );
  });

  test("platform payload rejections map to the too-large copy", () => {
    const vercelPage =
      "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE\n\niad1::abcde-1700000000000-0123456789ab";

    expect(getChatErrorMessage(bodyError(vercelPage))).toBe(JEV_INPUT_TOO_LARGE_MESSAGE);
    expect(getChatErrorMessage("FUNCTION_PAYLOAD_TOO_LARGE")).toBe(JEV_INPUT_TOO_LARGE_MESSAGE);
    expect(
      getChatErrorMessage(
        bodyError("<html><head><title>413 Request Entity Too Large</title></head></html>")
      )
    ).toBe(JEV_INPUT_TOO_LARGE_MESSAGE);
    expect(getChatErrorMessage(bodyError("413 Payload Too Large"))).toBe(
      JEV_INPUT_TOO_LARGE_MESSAGE
    );
  });

  test("an unmapped JSON status shows the body's error text, not the raw JSON", () => {
    const conflict = "That message already has a reply.";

    expect(getChatErrorMessage(bodyError({ error: conflict, status: 409 }))).toBe(conflict);
    expect(getChatErrorMessage(bodyError({ status: 503, error: `  ${conflict}\n` }))).toBe(
      conflict
    );
  });

  test("a JSON error without a status also shows its error text", () => {
    expect(getChatErrorMessage(bodyError({ error: "Thread is archived." }))).toBe(
      "Thread is archived."
    );
  });

  test("known message patterns still win over the body's error text", () => {
    expect(
      getChatErrorMessage(bodyError({ error: "Token usage limit exceeded", status: 403 }))
    ).toBe(CHAT_ERROR_MESSAGES[429]!);
    expect(getChatErrorMessage(bodyError({ error: "Payload Too Large", status: 500 }))).toBe(
      JEV_INPUT_TOO_LARGE_MESSAGE
    );
  });

  test("a mapped status wins over the body's error text", () => {
    expect(getChatErrorMessage(bodyError({ error: "Slow down there", status: 429 }))).toBe(
      CHAT_ERROR_MESSAGES[429]!
    );
  });

  test("non-string or blank error fields fall back to the raw message", () => {
    const objectError = JSON.stringify({ error: { code: "conflict" }, status: 409 });
    const blankError = JSON.stringify({ error: "   ", status: 409 });

    expect(getChatErrorMessage(new Error(objectError))).toBe(objectError);
    expect(getChatErrorMessage(new Error(blankError))).toBe(blankError);
  });

  test("JSON that is not an object does not throw", () => {
    expect(getChatErrorMessage("null")).toBe("null");
    expect(getChatErrorMessage("409")).toBe("409");
    expect(getChatErrorMessage('"quoted"')).toBe('"quoted"');
    expect(getChatErrorMessage("[1,2]")).toBe("[1,2]");
  });

  test("plain text errors pass through trimmed", () => {
    expect(getChatErrorMessage(new Error("  Stream interrupted  "))).toBe("Stream interrupted");
  });

  test("empty or non-error inputs use the generic fallback", () => {
    expect(getChatErrorMessage(undefined)).toBe(FALLBACK);
    expect(getChatErrorMessage(null)).toBe(FALLBACK);
    expect(getChatErrorMessage({ message: "not an Error" })).toBe(FALLBACK);
    expect(getChatErrorMessage(new Error(""))).toBe(FALLBACK);
    expect(getChatErrorMessage("   ")).toBe(FALLBACK);
  });
});
