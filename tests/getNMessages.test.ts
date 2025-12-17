import { describe, test, expect, mock, beforeEach } from "bun:test";
import { getNMessages } from "@/data/supabase/chat";
import {
  MockSupabaseClient,
  createTestMessages,
} from "./helpers/mock-supabase";

describe("getNMessages", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    mockClient = new MockSupabaseClient();
    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.resolve(mockClient),
    }));
  });

  test("returns N newest messages in chronological order", async () => {
    const chatId = "chat-1";
    mockClient.insertMessages(createTestMessages(chatId, 10));

    const result = await getNMessages(chatId, 3);

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data).toHaveLength(3);
    expect(result.data!.map((m) => m.id).join(",")).toBe(
      "chat-1-msg-8,chat-1-msg-9,chat-1-msg-10"
    );
  });

  test("handles empty chat", async () => {
    const result = await getNMessages("empty-chat", 5);

    expect(result.error).toBeNull();
    expect(result.data ?? []).toHaveLength(0);
  });

  test("handles limit larger than available messages", async () => {
    const chatId = "chat-2";
    mockClient.insertMessages(createTestMessages(chatId, 3));

    const result = await getNMessages(chatId, 10);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(3);
  });

  test("uses default limit when not provided", async () => {
    const chatId = "chat-3";
    mockClient.insertMessages(createTestMessages(chatId, 15));

    const result = await getNMessages(chatId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(10);
  });

  test("returns error for limit 0", async () => {
    const result = await getNMessages("chat-4", 0);

    expect(result.data).toHaveLength(0);
    expect(result.error).toBe("Limit should not be zero");
  });

  test("handles database errors gracefully", async () => {
    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.reject(new Error("DB down")),
    }));

    const result = await getNMessages("chat-5", 5);

    expect(result.data).toHaveLength(0);
    expect(result.error).toBe("DB down");
  });

  test("filters messages by thread_id", async () => {
    mockClient.insertMessages([
      ...createTestMessages("chat-a", 5),
      ...createTestMessages("chat-b", 5),
    ]);

    const result = await getNMessages("chat-b", 3);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(3);
    expect(result.data!.every((m) => m.id.startsWith("chat-b-"))).toBe(true);
  });
});
