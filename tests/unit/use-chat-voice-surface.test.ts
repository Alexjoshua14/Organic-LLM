import type { ChatStatus, UIMessage } from "ai";

import { describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";

import { useChatVoiceSurface } from "@/hooks/use-chat-voice-surface";
import { screenSurfaceKey } from "@/lib/schemas/speak-screen-context";
import { ensureDom } from "../helpers/render";
import { CHAT_THREAD_ID, chatMessage } from "../helpers/speak-fixtures";

ensureDom();

const settledThread = [chatMessage("m1", "user", "Hi"), chatMessage("m2", "assistant", "Hello")];

function surface(messages: UIMessage[], status: ChatStatus) {
  return renderHook(
    ({ messages, status }) => useChatVoiceSurface(CHAT_THREAD_ID, messages, status),
    { initialProps: { messages, status } }
  );
}

describe("useChatVoiceSurface", () => {
  test("a settled thread is revisioned by its last message", () => {
    const { result } = surface(settledThread, "ready");

    expect(result.current).toEqual({ kind: "chat", id: CHAT_THREAD_ID, revision: "m2" });
  });

  test("holds the revision through a turn, then moves once the reply settles", () => {
    const { result, rerender } = surface(settledThread, "ready");

    // The user's message is on screen but the server has not saved it yet.
    const sent = [...settledThread, chatMessage("m3", "user", "Tell me more")];

    rerender({ messages: sent, status: "submitted" });
    expect(result.current?.revision).toBe("m2");

    const streaming = [...sent, chatMessage("m4", "assistant", "Sure —")];

    rerender({ messages: streaming, status: "streaming" });
    expect(result.current?.revision).toBe("m2");

    rerender({ messages: streaming, status: "ready" });
    expect(result.current?.revision).toBe("m4");
  });

  test("the key changes exactly once per finished exchange", () => {
    const { result, rerender } = surface(settledThread, "ready");
    const keys = new Set([screenSurfaceKey(result.current!)]);

    const next = [
      ...settledThread,
      chatMessage("m3", "user", "More"),
      chatMessage("m4", "assistant", "…"),
    ];

    for (const status of ["submitted", "streaming", "streaming", "ready"] as const) {
      rerender({ messages: next, status });
      keys.add(screenSurfaceKey(result.current!));
    }

    expect([...keys]).toEqual([`chat:${CHAT_THREAD_ID}:m2`, `chat:${CHAT_THREAD_ID}:m4`]);
  });

  test("a failed turn settles too, so voice is not stuck on the old revision", () => {
    const { result, rerender } = surface(settledThread, "ready");
    const next = [...settledThread, chatMessage("m3", "user", "More")];

    rerender({ messages: next, status: "error" });

    expect(result.current?.revision).toBe("m3");
  });

  test("no thread yet means nothing to register", () => {
    const { result } = renderHook(() => useChatVoiceSurface(null, [], "ready"));

    expect(result.current).toBeNull();
  });
});
