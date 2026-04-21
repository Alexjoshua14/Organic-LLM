import { describe, expect, test } from "bun:test";

import { StrataIngestRequestSchema } from "@/lib/schemas/strata";

describe("StrataIngestRequestSchema", () => {
  test("parses search op", () => {
    const r = StrataIngestRequestSchema.safeParse({
      pageId: "00000000-0000-4000-8000-000000000099",
      op: "search",
      query: "climate",
    });
    expect(r.success).toBe(true);
  });

  test("rejects unknown op", () => {
    const r = StrataIngestRequestSchema.safeParse({
      pageId: "00000000-0000-4000-8000-000000000099",
      op: "nope",
    });
    expect(r.success).toBe(false);
  });
});
