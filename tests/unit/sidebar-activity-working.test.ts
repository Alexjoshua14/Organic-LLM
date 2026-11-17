import { describe, expect, test } from "bun:test";

import { isWorking } from "@/hooks/use-sidebar-activity";

describe("shared activity poll", () => {
  test("keeps running while a chat-created rabbit hole generates, even with no working thread", () => {
    expect(isWorking({ data: [], rabbitHoles: [] })).toBe(false);
    expect(
      isWorking({ data: [], rabbitHoles: [{ sessionId: "s", nodeId: "n", step: "article" }] })
    ).toBe(true);
    expect(isWorking({ data: [{ id: "t", unseen: false, working: { step: null } }] })).toBe(true);
    expect(isWorking(undefined)).toBe(false);
  });
});
