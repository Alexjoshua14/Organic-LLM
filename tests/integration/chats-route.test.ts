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
const mockGetChats = mock(async () => ({
  data: [],
  error: null,
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

mock.module("@/data/supabase/chat", () => ({
  getChats: mockGetChats,
}));

mock.module("@/lib/rate-limit/chats", () => ({
  checkChatsListLimit: mockCheckChatsListLimit,
}));

import { GET } from "@/app/api/chats/route";

describe("GET /api/chats", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockGetChats.mockClear();
    mockCheckChatsListLimit.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetSupabaseUserId.mockResolvedValue({
      data: "sb_test_user",
      error: null,
    });
    mockGetChats.mockResolvedValue({
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
    expect(mockGetChats).not.toHaveBeenCalled();
  });

  test("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockCheckChatsListLimit).not.toHaveBeenCalled();
    expect(mockGetSupabaseUserId).not.toHaveBeenCalled();
    expect(mockGetChats).not.toHaveBeenCalled();
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
    expect(mockGetChats).not.toHaveBeenCalled();
  });

  test("returns 500 when fetching chats fails", async () => {
    mockGetChats.mockResolvedValueOnce({
      data: null,
      error: new Error("db down"),
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch chats" });
  });

  test("returns an empty data array when chats data is null", async () => {
    mockGetChats.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  test("passes the resolved owner id into getChats and returns chat data", async () => {
    mockGetSupabaseUserId.mockResolvedValueOnce({
      data: "sb_owner_123",
      error: null,
    });
    mockGetChats.mockResolvedValueOnce({
      data: [
        {
          id: "thread-1",
          title: "First thread",
          owner_id: "sb_owner_123",
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T01:00:00.000Z",
          pinned: true,
        },
      ],
      error: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetChats).toHaveBeenCalledWith({ ownerId: "sb_owner_123" });
    expect(body).toEqual({
      data: [
        expect.objectContaining({
          id: "thread-1",
          owner_id: "sb_owner_123",
        }),
      ],
    });
  });
});
