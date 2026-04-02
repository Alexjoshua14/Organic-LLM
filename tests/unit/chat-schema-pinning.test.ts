import { describe, expect, test } from "bun:test";

import {
  MessageContextLinkMutationSchema,
  PinTargetTypeSchema,
  SendModeSchema,
} from "@/lib/schemas/chat";

describe("chat pinning schemas", () => {
  test("accepts supported target types", () => {
    expect(PinTargetTypeSchema.parse("thread")).toBe("thread");
    expect(PinTargetTypeSchema.parse("persona")).toBe("persona");
  });

  test("validates pin mutation payload", () => {
    const parsed = MessageContextLinkMutationSchema.parse({
      threadId: "7b52de83-bf70-4b7b-8d9b-4a306b8b8d87",
      messageId: "50ec42bf-4c31-43a0-ab25-b3c83ec8df5a",
      targetType: "thread",
    });

    expect(parsed.targetType).toBe("thread");
  });

  test("send mode enum includes respond/process_only", () => {
    expect(SendModeSchema.parse("respond")).toBe("respond");
    expect(SendModeSchema.parse("process_only")).toBe("process_only");
  });
});
