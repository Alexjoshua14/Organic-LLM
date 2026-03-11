import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { SearchResult } from "mem0ai/oss";

import type { RateLimitResult } from "@/lib/rate-limit/memory";
import type { Result } from "@/types";
import { createMockClerkUser } from "../helpers/mock-auth";

// Prevent server-only from throwing when store or its dependents are resolved
mock.module("server-only", () => ({}));

const mockAuth = mock(async () => createMockClerkUser());
const mockGetSupabaseUserId = mock(async (): Promise<Result<string>> => ({
  data: "sb_test_user",
  error: null,
}));

const mockCheckMemorySearchLimit = mock(async () => ({ success: true }));
const mockCheckMemoryListLimit = mock(async () => ({ success: true }));
const mockCheckMemoryDeleteLimit = mock(async () => ({ success: true }));
const mockCheckMemoryWipeLimit = mock(async () => ({ success: true }));

const mockSearchMemories = mock(async (): Promise<SearchResult> => ({
  results: [],
  relations: [],
}));
const mockGetAllMemories = mock(async () => ({
  results: [{ id: "mem_1", memory: "test", metadata: {} }],
  relations: [],
}));
const mockDeleteMemory = mock(async () => true);
const mockWipeMemory = mock(async () => true);

mock.module("@clerk/nextjs/server", () => ({ auth: mockAuth }));
mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
}));
mock.module("@/lib/rate-limit/memory", () => ({
  checkMemorySearchLimit: mockCheckMemorySearchLimit,
  checkMemoryListLimit: mockCheckMemoryListLimit,
  checkMemoryDeleteLimit: mockCheckMemoryDeleteLimit,
  checkMemoryWipeLimit: mockCheckMemoryWipeLimit,
}));
mock.module("@/lib/memory/store", () => ({
  searchMemories: mockSearchMemories,
  getAllMemories: mockGetAllMemories,
  deleteMemory: mockDeleteMemory,
  wipeMemory: mockWipeMemory,
}));

describe("Memory operations (secure client–store)", () => {
  let operations: typeof import("@/lib/memory/operations");

  beforeEach(async () => {
    operations = await import("@/lib/memory/operations");
    mockAuth.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockCheckMemorySearchLimit.mockClear();
    mockCheckMemoryListLimit.mockClear();
    mockCheckMemoryDeleteLimit.mockClear();
    mockCheckMemoryWipeLimit.mockClear();
    mockSearchMemories.mockClear();
    mockGetAllMemories.mockClear();
    mockDeleteMemory.mockClear();
    mockWipeMemory.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetSupabaseUserId.mockResolvedValue({
      data: "sb_test_user",
      error: null,
    });
    mockCheckMemorySearchLimit.mockResolvedValue({ success: true });
    mockCheckMemoryListLimit.mockResolvedValue({ success: true });
    mockCheckMemoryDeleteLimit.mockResolvedValue({ success: true });
    mockCheckMemoryWipeLimit.mockResolvedValue({ success: true });
    mockGetAllMemories.mockResolvedValue({
      results: [{ id: "mem_1", memory: "test", metadata: {} }],
      relations: [],
    });
  });

  test("unauthenticated access returns auth failure", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const [search, getCurrent, getBySearch, deleteMem, wipe] = await Promise.all([
      operations.searchMemoriesServer("q"),
      operations.getCurrentUserMemories(),
      operations.getCurrentUserMemoriesBySearch("q"),
      operations.deleteMemoryForCurrentUser("mem_1"),
      operations.wipeMemoryForCurrentUser(),
    ]);

    expect(search.error).toBe("Not signed in");
    expect(getCurrent.error).toBe("Not signed in");
    expect(getBySearch.error).toBe("Not signed in");
    expect(deleteMem.error).toBe("Not signed in");
    expect(wipe.error).toBe("Not signed in");

    expect(mockGetSupabaseUserId.mock.calls.length).toBe(0);
    expect(mockGetAllMemories.mock.calls.length).toBe(0);
    expect(mockDeleteMemory.mock.calls.length).toBe(0);
    expect(mockWipeMemory.mock.calls.length).toBe(0);
  });

  test("user not found in Supabase returns error", async () => {
    mockGetSupabaseUserId.mockResolvedValueOnce({
      data: null,
      error: new Error("not found"),
    });

    const result = await operations.getCurrentUserMemories();

    expect(result.error).toBe("User profile not found");
    expect(mockGetAllMemories.mock.calls.length).toBe(0);
  });

  test("cross-user delete is denied (memory not in current user list)", async () => {
    mockGetAllMemories.mockResolvedValueOnce({
      results: [],
      relations: [],
    });

    const result = await operations.deleteMemoryForCurrentUser("mem_other_user");

    expect(result.error).toBe("Memory not found");
    expect(mockDeleteMemory.mock.calls.length).toBe(0);
  });

  test("current-user delete succeeds when memory belongs to user", async () => {
    const result = await operations.deleteMemoryForCurrentUser("mem_1");

    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
    expect(mockDeleteMemory.mock.calls.length).toBe(1);
    expect((mockDeleteMemory.mock.calls[0] as string[])[0]).toBe("mem_1");
  });

  test("current-user wipe succeeds", async () => {
    const result = await operations.wipeMemoryForCurrentUser();

    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
    expect(mockWipeMemory.mock.calls.length).toBe(1);
    expect((mockWipeMemory.mock.calls[0] as string[])[0]).toBe("sb_test_user");
  });

  test("rate-limit exceeded returns structured error", async () => {
    mockCheckMemoryListLimit.mockResolvedValueOnce({
      success: false,
      error: "Too many list requests",
    } as RateLimitResult);

    const result = await operations.getCurrentUserMemories();

    expect(result.error).toContain("Too many");
    expect(mockGetAllMemories.mock.calls.length).toBe(0);
  });

  test("searchMemoriesServer success path", async () => {
    mockSearchMemories.mockResolvedValueOnce({
      results: [{ id: "m1", memory: "found", metadata: {} }],
      relations: [],
    });

    const result = await operations.searchMemoriesServer("query");

    expect(result.error).toBeNull();
    expect(result.data?.results).toHaveLength(1);
    expect(mockSearchMemories.mock.calls.length).toBe(1);
    const searchCall = mockSearchMemories.mock.calls[0] as unknown as [
      string,
      string,
      undefined,
    ];
    expect(searchCall[0]).toBe("query");
    expect(searchCall[1]).toBe("sb_test_user");
    expect(searchCall[2]).toBe(undefined);
  });

  test("getCurrentUserMemories success path", async () => {
    const result = await operations.getCurrentUserMemories();

    expect(result.error).toBeNull();
    expect(result.data?.results).toHaveLength(1);
    expect(mockGetAllMemories.mock.calls.length).toBe(1);
    expect((mockGetAllMemories.mock.calls[0] as string[])[0]).toBe("sb_test_user");
  });

  test("invalid query returns validation error", async () => {
    const result = await operations.searchMemoriesServer("x".repeat(2001));

    expect(result.error).toContain("Invalid or too long");
    expect(mockSearchMemories.mock.calls.length).toBe(0);
  });

  test("invalid memoryId returns validation error", async () => {
    const result = await operations.deleteMemoryForCurrentUser("");

    expect(result.error).toContain("Invalid");
    expect(mockGetAllMemories.mock.calls.length).toBe(0);
  });
});
