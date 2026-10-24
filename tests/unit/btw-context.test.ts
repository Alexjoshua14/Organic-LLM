import type { UIMessage } from "ai";

import { describe, expect, test } from "bun:test";

import {
  BTW_MIN_RECENT_MESSAGES,
  BTW_RECENT_TOKEN_BUDGET,
  buildBtwSnapshotText,
  loadBtwContextSnapshot,
  messagePlainText,
} from "@/lib/chat/btw-context";
import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { parseSlashCommand } from "@/lib/chat/slash-command";

function message(id: string, role: "user" | "assistant", text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

describe("/btw context snapshot", () => {
  test("keeps visible prose and drops tool calls and reasoning", () => {
    const withTools = {
      id: "a",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "private chain of thought" },
        { type: "text", text: "Visible answer." },
        {
          type: "tool-web_search",
          toolCallId: "1",
          state: "output-available",
          input: {},
          output: "huge tool output",
        },
      ],
    } as unknown as UIMessage;

    expect(messagePlainText(withTools)).toBe("Visible answer.");
    expect(buildBtwSnapshotText(null, [withTools]).text).not.toContain("tool output");
  });

  test("includes the summary and the most recent turns, oldest first", () => {
    const snapshot = buildBtwSnapshotText("We are planning a trip.", [
      message("1", "user", "Where should we go?"),
      message("2", "assistant", "Lisbon."),
    ]);

    expect(snapshot.text).toContain("Thread summary so far:\nWe are planning a trip.");
    expect(snapshot.text.indexOf("User: Where")).toBeLessThan(
      snapshot.text.indexOf("Assistant: Lisbon")
    );
    expect(snapshot.includedMessages).toBe(2);
  });

  test("stays within budget on a long thread but always keeps the latest exchange", () => {
    const long = "word ".repeat(2_000);
    const messages = Array.from({ length: 40 }, (_, i) =>
      message(String(i), i % 2 === 0 ? "user" : "assistant", `${i}: ${long}`)
    );
    const snapshot = buildBtwSnapshotText(null, messages);

    expect(snapshot.includedMessages).toBeGreaterThanOrEqual(BTW_MIN_RECENT_MESSAGES);
    expect(snapshot.includedMessages).toBeLessThan(messages.length);
    expect(snapshot.text).toContain("Assistant: 39:");
    expect(estimateTokenCountSync(snapshot.text)).toBeLessThan(BTW_RECENT_TOKEN_BUDGET + 200);
  });

  test("loads through injected loaders and tolerates a failed load", async () => {
    const snapshot = await loadBtwContextSnapshot({
      loadSummary: async () => null,
      loadMessages: async () => null,
    });

    expect(snapshot.text).toContain("no visible messages");
    expect(snapshot.totalMessages).toBe(0);
  });
});

describe("slash commands", () => {
  test("parses a name and the rest as its argument", () => {
    expect(parseSlashCommand("/btw what is a monad?")).toEqual({
      name: "btw",
      argument: "what is a monad?",
    });
    expect(parseSlashCommand("  /BTW  ")).toEqual({ name: "btw", argument: "" });
    expect(parseSlashCommand("/btw first line\nsecond")?.argument).toBe("first line\nsecond");
  });

  test("ignores text that is not a command", () => {
    expect(parseSlashCommand("btw /btw")).toBeNull();
    expect(parseSlashCommand("/ btw")).toBeNull();
    expect(parseSlashCommand("/usr/bin is a path")).toBeNull();
  });
});
