import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import { messagePartsToCopyMarkdown } from "@/lib/chat/message-copy-markdown";
import { FIXTURE_ANSWER_CARD } from "@/lib/schemas/gen-ui/fixtures";

describe("messagePartsToCopyMarkdown", () => {
  test("includes text and gen-ui block markdown", () => {
    const parts: UIMessage["parts"] = [
      { type: "text", text: "Intro prose." },
      {
        type: "dynamic-tool",
        toolName: "render_gen_ui",
        toolCallId: "tc1",
        state: "output-available",
        input: {},
        output: { block: FIXTURE_ANSWER_CARD },
      },
    ];
    const md = messagePartsToCopyMarkdown(parts);
    expect(md).toContain("Intro prose.");
    expect(md).toContain(FIXTURE_ANSWER_CARD.title);
    expect(md).toContain("TL;DR");
  });
});
