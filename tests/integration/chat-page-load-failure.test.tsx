import { afterEach, describe, expect, mock, test } from "bun:test";

const mockLoadChat = mock(async () => ({
  data: null,
  error: new Error("Thread not found"),
}));

const chatStoreStub = async () => ({ data: null, error: new Error("chat-store mocked") });
mock.module("@/lib/chat/chat-store", () => ({
  createChat: chatStoreStub,
  loadChat: mockLoadChat,
  readChat: chatStoreStub,
  saveChat: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  saveMessage: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  deleteChatMessage: async () => ({ ok: false, error: new Error("chat-store mocked") }),
  getChats: async () => ({ data: null, error: new Error("chat-store mocked") }),
  getChat: chatStoreStub,
  getContext: async () => ({ data: null, error: "chat-store mocked" }),
  getContextAndMessagesChatPrompt: async () => ({ data: null, error: "chat-store mocked" }),
  getMessagesForChatPrompt: async () => ({ data: null, error: "chat-store mocked" }),
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
