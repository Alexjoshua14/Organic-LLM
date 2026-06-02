import { describe, expect, test } from "bun:test";

import {
  STRATA_CLIPBOARD_PASTE_MAX_CHARS,
  StrataClipboardSourceTitleBodySchema,
} from "@/lib/schemas/strata";

describe("StrataClipboardSourceTitleBodySchema", () => {
  test("accepts excerpt at max length", () => {
    const excerpt = "a".repeat(STRATA_CLIPBOARD_PASTE_MAX_CHARS);
    const r = StrataClipboardSourceTitleBodySchema.safeParse({
      pageId: "00000000-0000-4000-8000-000000000099",
      excerpt,
    });

    expect(r.success).toBe(true);
  });

  test("rejects excerpt over max length", () => {
    const excerpt = "a".repeat(STRATA_CLIPBOARD_PASTE_MAX_CHARS + 1);
    const r = StrataClipboardSourceTitleBodySchema.safeParse({
      pageId: "00000000-0000-4000-8000-000000000099",
      excerpt,
    });

    expect(r.success).toBe(false);
  });

  test("accepts local page id", () => {
    const r = StrataClipboardSourceTitleBodySchema.safeParse({
      pageId: "local-abc",
      excerpt: "hello",
    });

    expect(r.success).toBe(true);
  });
});
