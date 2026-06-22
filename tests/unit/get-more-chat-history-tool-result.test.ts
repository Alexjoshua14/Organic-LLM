import { describe, expect, test } from "bun:test";

import {
  formatGetMoreChatHistoryExpandedDetail,
  tryParseGetMoreChatHistoryToolOutput,
} from "@/lib/chat/get-more-chat-history-tool-output";

describe("tryParseGetMoreChatHistoryToolOutput", () => {
  test("parses successful tool output with context stats", () => {
    expect(
      tryParseGetMoreChatHistoryToolOutput({
        success: true,
        count: 10,
        messagesInContext: 31,
        totalMessagesInThread: 50,
        messages: "older transcript",
      })
    ).toEqual({
      kind: "ok",
      count: 10,
      messagesInContext: 31,
      totalMessagesInThread: 50,
    });
  });

  test("parses error tool output", () => {
    expect(
      tryParseGetMoreChatHistoryToolOutput({
        success: false,
        count: 0,
        error: "Database unavailable",
        messages: "",
      })
    ).toEqual({
      kind: "error",
      message: "Database unavailable",
    });
  });

  test("returns null for unrelated shapes", () => {
    expect(tryParseGetMoreChatHistoryToolOutput({ query: "hello" })).toBeNull();
  });
});

describe("formatGetMoreChatHistoryExpandedDetail", () => {
  test("formats full context stats", () => {
    expect(
      formatGetMoreChatHistoryExpandedDetail({
        kind: "ok",
        count: 10,
        messagesInContext: 31,
        totalMessagesInThread: 50,
      })
    ).toBe("Expanded context by 10 messages • 31 / 50 in working context");
  });
});
