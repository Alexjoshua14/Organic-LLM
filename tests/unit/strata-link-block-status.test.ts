import { describe, expect, test } from "bun:test";

import { LINK_BLOCK_STATUS_COPY, StrataLinkBlockStreamChunkSchema } from "@/lib/strata/link-block-status";

describe("strata link block stream schema", () => {
  test("accepts status chunk payload", () => {
    const payload = {
      type: "status",
      event: {
        blockId: "00000000-0000-4000-8000-000000000001",
        code: "summarizing",
        message: "Generating concise summary",
        at: new Date().toISOString(),
      },
    };
    const parsed = StrataLinkBlockStreamChunkSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  test("status copy includes UX-facing message", () => {
    expect(LINK_BLOCK_STATUS_COPY.streaming_response).toContain("Streaming");
  });
});
