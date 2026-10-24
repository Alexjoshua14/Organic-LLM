import { describe, expect, test } from "bun:test";

import {
  OPTIMISTIC_MESSAGE_RECEIVED_LABEL,
  resolveThreadLiveAiAction,
} from "@/lib/chat/optimistic-ai-action";
import { ChatAIActionEnum } from "@/types/ai";

describe("resolveThreadLiveAiAction", () => {
  test("shows optimistic receipt after a user message once the turn is submitted", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "user",
      status: "submitted",
    });

    expect(result.placement).toBe("after-user");
    expect(result.payload).toEqual({
      action: ChatAIActionEnum.Processing,
      message: OPTIMISTIC_MESSAGE_RECEIVED_LABEL,
    });
  });

  test("keeps the optimistic receipt while streaming before an assistant row exists", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "user",
      status: "streaming",
    });

    expect(result.placement).toBe("after-user");
    expect(result.payload?.message).toBe(OPTIMISTIC_MESSAGE_RECEIVED_LABEL);
  });

  test("prefers stream aiAction over the optimistic label", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "user",
      status: "submitted",
      aiActionPayload: {
        action: ChatAIActionEnum.Processing,
        message: "Gathering context",
      },
    });

    expect(result.placement).toBe("after-user");
    expect(result.payload?.message).toBe("Gathering context");
  });

  test("attaches stream aiAction to the assistant row once it exists", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "assistant",
      status: "streaming",
      aiActionPayload: {
        action: ChatAIActionEnum.Processing,
        message: "Thinking...",
      },
    });

    expect(result.placement).toBe("last-message");
    expect(result.payload?.message).toBe("Thinking...");
  });

  test("does not invent a receipt on an idle user-last thread", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "user",
      status: "ready",
    });

    expect(result).toEqual({ payload: undefined, placement: "none" });
  });

  test("does not invent a receipt when the last row is already the assistant", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "assistant",
      status: "streaming",
    });

    expect(result).toEqual({ payload: undefined, placement: "none" });
  });

  test("shows stream error payload after the user row", () => {
    const result = resolveThreadLiveAiAction({
      lastMessageRole: "user",
      status: "error",
      aiActionPayload: { action: ChatAIActionEnum.Errored },
    });

    expect(result.placement).toBe("after-user");
    expect(result.payload?.action).toBe(ChatAIActionEnum.Errored);
  });
});
