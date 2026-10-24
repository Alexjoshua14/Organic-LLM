import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  createMockAuth,
  createMockClerkUser,
} from "../helpers/mock-auth";
import { encodeSidebarCursor } from "@/lib/chat/sidebar-threads";

const mockAuth = mock(createMockAuth());
const mockGetSupabaseUserIdCached = mock(async () => ({
  data: "sb_test_user" as string | null,
  error: null as Error | null,
}));
const mockGetSidebarThreadsPage = mock(async (_options: unknown) => ({
  data: { data: [], pinned: [], nextCursor: null } as unknown,
  error: null as Error | null,
}));
const mockCheckChatsListLimit = mock(async () => ({
  success: true,
  remaining: 240,
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("@/data/supabase/profile-id-cache", () => ({
  getSupabaseUserIdCached: mockGetSupabaseUserIdCached,
}));

mock.module("@/data/supabase/sidebar-threads", () => ({
  getSidebarThreadsPage: mockGetSidebarThreadsPage,
}));

mock.module("@/lib/rate-limit/chats", () => ({
  checkChatsListLimit: mockCheckChatsListLimit,
}));

import { GET } from "@/app/api/chats/route";

const request = (query = "") => new Request(`http://localhost/api/chats${query}`);

describe("GET /api/chats", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetSupabaseUserIdCached.mockClear();
    mockGetSidebarThreadsPage.mockClear();
    mockCheckChatsListLimit.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetSupabaseUserIdCached.mockResolvedValue({ data: "sb_test_user", error: null });
    mockGetSidebarThreadsPage.mockResolvedValue({
      data: { data: [], pinned: [], nextCursor: null },
      error: null,
    });
    mockCheckChatsListLimit.mockResolvedValue({ success: true, remaining: 240 });
  });

  test("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockCheckChatsListLimit).not.toHaveBeenCalled();
    expect(mockGetSupabaseUserIdCached).not.toHaveBeenCalled();
    expect(mockGetSidebarThreadsPage).not.toHaveBeenCalled();
  });

  test("returns 400 for a malformed cursor without spending the rate limit", async () => {
    const res = await GET(request("?cursor=not-a-cursor"));

    expect(res.status).toBe(400);
    expect(mockCheckChatsListLimit).not.toHaveBeenCalled();
    expect(mockGetSidebarThreadsPage).not.toHaveBeenCalled();
  });

  test("returns 429 when thread list rate limit is exceeded", async () => {
    mockCheckChatsListLimit.mockResolvedValueOnce({
      success: false,
      error: "Too many requests. Thread list is limited to 240 requests per hour. Try again later.",
    } as never);

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain("240");
    expect(mockGetSidebarThreadsPage).not.toHaveBeenCalled();
  });

  test("returns 404 when the Clerk user has no Supabase profile", async () => {
    mockGetSupabaseUserIdCached.mockResolvedValueOnce({ data: null, error: new Error("not found") });

    const res = await GET(request());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "User not found" });
    expect(mockGetSidebarThreadsPage).not.toHaveBeenCalled();
  });

  test("checks the rate limit and resolves the owner together", async () => {
    let limiterStarted = false;
    let ownerStartedBeforeLimiterResolved = false;
    let resolveLimiter: (value: { success: boolean; remaining: number }) => void = () => {};

    mockCheckChatsListLimit.mockImplementationOnce(() => {
      limiterStarted = true;

      return new Promise((resolve) => {
        resolveLimiter = resolve;
      });
    });
    mockGetSupabaseUserIdCached.mockImplementationOnce(async () => {
      ownerStartedBeforeLimiterResolved = limiterStarted;
      resolveLimiter({ success: true, remaining: 239 });

      return { data: "sb_test_user", error: null };
    });

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(ownerStartedBeforeLimiterResolved).toBe(true);
  });

  test("returns 500 with Server-Timing when the page query fails", async () => {
    mockGetSidebarThreadsPage.mockResolvedValueOnce({ data: null, error: new Error("db down") });

    const res = await GET(request());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch chats" });
    expect(res.headers.get("Server-Timing")).toContain("total;dur=");
  });

  test("passes owner, scope, cursor, and clamped limit, and returns the page", async () => {
    const cursor = encodeSidebarCursor({ updatedAt: "2026-10-04T10:00:00.123456+00:00", id: "t-9" });
    const page = {
      data: [
        {
          id: "thread-1",
          title: "First thread",
          owner_id: "sb_test_user",
          created_at: "2026-03-08T00:00:00.000Z",
          updated_at: "2026-03-08T01:00:00.000Z",
          pinned: false,
        },
      ],
      nextCursor: "next",
    };

    mockGetSidebarThreadsPage.mockResolvedValueOnce({ data: page, error: null });

    const res = await GET(request(`?scope=all&cursor=${cursor}&limit=500`));

    expect(res.status).toBe(200);
    expect(mockGetSidebarThreadsPage).toHaveBeenCalledWith({
      ownerId: "sb_test_user",
      scope: "all",
      cursor: { updatedAt: "2026-10-04T10:00:00.123456+00:00", id: "t-9" },
      limit: 100,
    });
    expect(await res.json()).toEqual(page);
    expect(res.headers.get("Server-Timing")).toMatch(/auth;dur=.*gate;dur=.*db;dur=.*total;dur=/);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("defaults to the main scope, first page, and default page size", async () => {
    await GET(request());

    expect(mockGetSidebarThreadsPage).toHaveBeenCalledWith({
      ownerId: "sb_test_user",
      scope: "main",
      cursor: null,
      limit: 50,
    });
  });
});
