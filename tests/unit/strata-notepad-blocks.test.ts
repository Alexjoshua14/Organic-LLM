import { describe, expect, test } from "bun:test";

import {
  blocksToCanonicalMarkdown,
  createLinkBlock,
  createTextBlock,
  inferBlocksFromBody,
  parseNotepadBlocksByNoteId,
  setNotepadBlocksInContentJson,
} from "@/lib/strata/notepad-blocks";

describe("strata notepad blocks", () => {
  test("falls back to one text block for plain body", () => {
    const blocks = inferBlocksFromBody("Line A\n\nLine B");
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.type).toBe("text");
    if (blocks[0]?.type === "text") {
      expect(blocks[0].text).toContain("Line A");
    }
  });

  test("canonical markdown includes link title and summary", () => {
    const text = createTextBlock("Opening paragraph");
    const link = createLinkBlock("https://example.com");

    if (link.type !== "link") throw new Error("Expected link block");
    link.title = "Example Domain";
    link.summary = "Concise summary from the URL.";
    link.state = "resolved";
    const markdown = blocksToCanonicalMarkdown([text, link]);
    expect(markdown).toContain("Opening paragraph");
    expect(markdown).toContain("[Example Domain](https://example.com)");
    expect(markdown).toContain("Concise summary from the URL.");
  });

  test("stores and parses notepad blocks map in contentJson", () => {
    const noteId = "00000000-0000-4000-8000-000000000001";
    const contentJson = setNotepadBlocksInContentJson(null, {
      [noteId]: [createTextBlock("hello")],
    });
    const parsed = parseNotepadBlocksByNoteId(contentJson);

    expect(Array.isArray(parsed[noteId])).toBe(true);
    expect(parsed[noteId]?.[0]?.type).toBe("text");
  });
});
