import { afterEach, describe, expect, mock, test } from "bun:test";

const mockLoadChat = mock(async () => ({
  data: null,
  error: new Error("Thread not found"),
}));

mock.module("@/lib/chat/chat-store", () => ({
  loadChat: mockLoadChat,
}));

mock.module("@/data/supabase/chat", () => ({
  getNMessages: mock(async () => ({ data: [], error: null })),
}));

import { ChatLoadError } from "@/app/chat/[slug]/chat-load-error";

describe("Chat page load failure", () => {
  afterEach(() => {
    mockLoadChat.mockClear();
    mockLoadChat.mockResolvedValue({
      data: null,
      error: new Error("Thread not found"),
    });
  });

  test("when loadChat fails, page returns ChatLoadError (non-success state)", async () => {
    const ChatPage = (await import("@/app/chat/[slug]/page")).default;
    const jsx = await ChatPage({
      params: Promise.resolve({ slug: "non-existent-thread-id" }),
    });

    expect(jsx).toBeDefined();
    expect(jsx?.type).toBe(ChatLoadError);
    expect(mockLoadChat).toHaveBeenCalledWith("non-existent-thread-id");
  });
});
