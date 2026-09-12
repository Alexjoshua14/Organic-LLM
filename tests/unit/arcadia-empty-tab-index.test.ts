import { describe, expect, test } from "bun:test";

import {
  ARCADIA_CHAT_STYLE_TAB_CYCLE,
  arcadiaEmptyStyleFocusIndex,
} from "@/lib/chat/arcadia-empty-tab-index";

describe("arcadiaEmptyStyleFocusIndex", () => {
  test("loops every four tab stops across chat styles", () => {
    expect(ARCADIA_CHAT_STYLE_TAB_CYCLE).toBe(4);

    const expected = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1];
    for (const [sequenceIndex, styleIndex] of expected.entries()) {
      expect(arcadiaEmptyStyleFocusIndex(sequenceIndex)).toBe(styleIndex);
    }
  });
});
