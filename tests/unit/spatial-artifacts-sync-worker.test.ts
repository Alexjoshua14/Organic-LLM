import { describe, expect, test } from "bun:test";

import { buildArtifactIdFromJob } from "@/lib/spatial-artifacts/sync/sync-worker";

const THREAD_ID = "22222222-2222-4222-8222-222222222222";

describe("sync-worker helpers", () => {
  test("buildArtifactIdFromJob delegates to spatialArtifactId", () => {
    expect(
      buildArtifactIdFromJob({
        threadId: THREAD_ID,
        messageId: "msg-1",
        toolCallId: "call_x",
      })
    ).toBe(`${THREAD_ID}:call_x`);
  });
});
