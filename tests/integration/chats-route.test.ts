import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  createMockAuth,
  createMockClerkUser,
} from "../helpers/mock-auth";

const mockAuth = mock(createMockAuth());
const mockGetSupabaseUserId = mock(async () => ({
  data: "sb_test_user",
  error: null,
}));
const mockGetSidebarThreads = mock(async () => ({
  data: [] as unknown[] | null,
  error: null as Error | null,
}));
const mockCheckChatsListLimit = mock(async () => ({
  success: true,
  remaining: 240,
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
}));

mock.module("@/data/supabase/sidebar-threads", () => ({
  getSidebarThreads: mockGetSidebarThreads,
}));

mock.module("@/lib/rate-limit/chats", () => ({
  checkChatsListLimit: mockCheckChatsListLimit,
}));

import { GET } from "@/app/api/chats/route";

describe("GET /api/chats", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockGetSidebarThreads.mockClear();
    mockCheckChatsListLimit.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetSupabaseUserId.mockResolvedValue({
      data: "sb_test_user",
      error: null,
    });
    mockGetSidebarThreads.mockResolvedValue({
      data: [],
      error: null,
    });
    mockCheckChatsListLimit.mockResolvedValue({ success: true, remaining: 240 });
  });

  test("returns 429 when thread list rate limit is exceeded", async () => {
    mockCheckChatsListLimit.mockResolvedValueOnce({
      success: false,
      error: "Too many requests. Thread list is limited to 240 requests per hour. Try again later.",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain("240");
    expect(mockGetSidebarThreads).not.toHaveBeenCalled();
  });

  test("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockCheckChatsListLimit).not.toHaveBeenCalled();
    expect(mockGetSupabaseUserId).not.toHaveBeenCalled();
    expect(mockGetSidebarThreads).not.toHaveBeenCalled();
  });

  test("returns 404 when the Clerk user has no Supabase profile", async () => {
    mockGetSupabaseUserId.mockResolvedValueOnce({
      data: null,
      error: new Error("not found"),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockGetSidebarThreads).not.toHaveBeenCalled();
  });

  test("returns 500 when fetching chats fails", async () => {
    mockGetSidebarThreads.mockResolvedValueOnce({
      data: null,
      error: new Error("db down"),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch chats" });
  });

  test("returns an empty data array when chats data is null", async () => {
    mockGetSidebarThreads.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  test("queries the sidebar rows for the resolved owner and returns them as-is", async () => {
    mockGetSupabaseUserId.mockResolvedValueOnce({
      data: "sb_owner_123",
      error: null,
    });
    const rows = [
      {
        id: "thread-1",
        title: "First thread",
        updated_at: "2026-03-08T01:00:00.000Z",
        pinned: true,
        feature: "main",
        path: null,
      },
    ];

    mockGetSidebarThreads.mockResolvedValueOnce({ data: rows, error: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetSidebarThreads).toHaveBeenCalledWith("sb_owner_123");
    expect(body).toEqual({ data: rows });
  });
});
