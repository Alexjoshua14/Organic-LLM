import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  MockSupabaseClient,
  createTestThreads,
} from "../helpers/mock-supabase";

mock.module("server-only", () => ({}));

describe("getChats", () => {
  let mockClient: MockSupabaseClient;
  let getChats: typeof import("@/data/supabase/chat").getChats;

  beforeEach(async () => {
    mockClient = new MockSupabaseClient();

    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.resolve(mockClient),
    }));

    ({ getChats } = await import("@/data/supabase/chat"));
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
    const ids = result.data!.map((thread) => thread.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("owner-a-thread-3");
    expect(ids[1]).toBe("owner-a-thread-2");
    expect(ids[2]).toBe("owner-a-thread-1");
  });

  test("omits the owner filter when ownerId is not provided", async () => {
    mockClient.insertThreads([
      ...createTestThreads("owner-a", 2),
      ...createTestThreads("owner-b", 2),
    ]);

    const result = await getChats();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(4);
    const ids = result.data!.map((thread) => thread.id);
    expect(ids).toContain("owner-a-thread-1");
    expect(ids).toContain("owner-a-thread-2");
    expect(ids).toContain("owner-b-thread-1");
    expect(ids).toContain("owner-b-thread-2");
  });

  test("returns a caught error when Supabase is unavailable", async () => {
    mock.module("@/lib/supabase/server", () => ({
      supabaseServer: () => Promise.reject(new Error("DB down")),
    }));
    ({ getChats } = await import("@/data/supabase/chat"));

    let caught: Error | null = null;
    try {
      await getChats({ ownerId: "owner-a" });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toBe("DB down");
  });
});
