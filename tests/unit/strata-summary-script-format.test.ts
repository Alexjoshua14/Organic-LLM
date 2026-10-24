import { describe, expect, test } from "bun:test";

import { normalizeSummaryScriptWhitespace } from "@/lib/tts/strata-summary-script-format";

describe("normalizeSummaryScriptWhitespace", () => {
  test("preserves spacing around Eleven v3 bracket tags", () => {
    expect(normalizeSummaryScriptWhitespace("hello   [pause]   world")).toBe("hello [pause] world");
  });

  test("trims and collapses plain whitespace", () => {
    expect(normalizeSummaryScriptWhitespace("  a  b  \n c  ")).toBe("a b c");
  });
});
