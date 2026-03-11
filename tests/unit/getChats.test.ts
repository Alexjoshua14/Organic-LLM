import { beforeEach, describe, expect, mock, test } from "bun:test";

import { getChats } from "@/data/supabase/chat";

import {
  MockSupabaseClient,
  createTestThreads,
} from "../helpers/mock-supabase";

describe("getChats", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    mockClient = new MockSupabaseClient();

    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.resolve(mockClient),
    }));
  });

  test("filters by owner_id when ownerId is provided", async () => {
    mockClient.insertThreads([
      ...createTestThreads("owner-a", 3, { titlePrefix: "Owner A" }),
      ...createTestThreads("owner-b", 2, { titlePrefix: "Owner B" }),
    ]);

    const result = await getChats({ ownerId: "owner-b" });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data!.every((thread) => thread.owner_id === "owner-b")).toBe(
      true,
    );
  });

  test("orders chats by updated_at descending when filtered", async () => {
    mockClient.insertThreads(createTestThreads("owner-a", 3));

    const result = await getChats({ ownerId: "owner-a" });

    expect(result.error).toBeNull();
    expect(result.data!.map((thread) => thread.id)).toEqual([
      "owner-a-thread-3",
      "owner-a-thread-2",
      "owner-a-thread-1",
    ]);
  });

  test("omits the owner filter when ownerId is not provided", async () => {
    mockClient.insertThreads([
      ...createTestThreads("owner-a", 2),
      ...createTestThreads("owner-b", 2),
    ]);

    const result = await getChats();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(4);
    expect(result.data!.map((thread) => thread.id)).toEqual([
      "owner-a-thread-2",
      "owner-b-thread-2",
      "owner-a-thread-1",
      "owner-b-thread-1",
    ]);
  });

  test("returns a caught error when Supabase is unavailable", async () => {
    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.reject(new Error("DB down")),
    }));

    await expect(getChats({ ownerId: "owner-a" })).rejects.toThrow("DB down");
  });
});
