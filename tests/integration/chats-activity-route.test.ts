import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";

const mockAuth = mock(createMockAuth());
const mockGetSupabaseUserId = mock(async () => ({ data: "sb_test_user", error: null }));
const mockGetThreadAttention = mock(async () => ({ data: [], error: null }));
const mockMarkThreadSeen = mock(async () => ({ ok: true, error: null }));
const mockCheckChatsActivityLimit = mock(async () => ({ success: true, remaining: 1800 }));

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
}));

mock.module("@/data/supabase/thread-attention", () => ({
  getThreadAttention: mockGetThreadAttention,
  markThreadSeen: mockMarkThreadSeen,
}));

// Full stub, like chats-route.test.ts: the last file to register wins, and each stubs both.
mock.module("@/lib/rate-limit/chats", () => ({
  checkChatsListLimit: async () => ({ success: true, remaining: 240 }),
  checkChatsActivityLimit: mockCheckChatsActivityLimit,
}));

import { GET } from "@/app/api/chats/activity/route";
import { POST } from "@/app/api/chats/[id]/seen/route";
import { SESSION_WORKING_STALE_MS } from "@/lib/sidebar/session-signal-timing";

const seenParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("sidebar activity routes", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockGetSupabaseUserId.mockReset();
    mockGetThreadAttention.mockReset();
    mockMarkThreadSeen.mockReset();
    mockCheckChatsActivityLimit.mockReset();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetSupabaseUserId.mockResolvedValue({ data: "sb_test_user", error: null });
    mockGetThreadAttention.mockResolvedValue({ data: [], error: null });
    mockMarkThreadSeen.mockResolvedValue({ ok: true, error: null });
    mockCheckChatsActivityLimit.mockResolvedValue({ success: true, remaining: 1800 });
  });

  describe("GET /api/chats/activity", () => {
    test("returns attention rows for the signed-in owner with the stale window applied", async () => {
      const rows = [
        { id: "t1", unseen: true, working: null },
        { id: "t2", unseen: false, working: { step: "article" } },
      ];

      mockGetThreadAttention.mockResolvedValueOnce({ data: rows, error: null } as never);

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ data: rows });
      expect(mockGetThreadAttention).toHaveBeenCalledWith({
        ownerId: "sb_test_user",
        staleAfterMs: SESSION_WORKING_STALE_MS,
      });
    });

    test("returns 401 when the user is not authenticated", async () => {
      mockAuth.mockResolvedValueOnce({ userId: null } as never);

      const res = await GET();

      expect(res.status).toBe(401);
      expect(mockCheckChatsActivityLimit).not.toHaveBeenCalled();
      expect(mockGetThreadAttention).not.toHaveBeenCalled();
    });

    test("returns 429 when the activity limit is exceeded", async () => {
      mockCheckChatsActivityLimit.mockResolvedValueOnce({
        success: false,
        error: "Too many requests.",
      } as never);

      const res = await GET();

      expect(res.status).toBe(429);
      expect(mockGetThreadAttention).not.toHaveBeenCalled();
    });

    test("returns 404 when the Clerk user has no Supabase profile", async () => {
      mockGetSupabaseUserId.mockResolvedValueOnce({ data: null, error: new Error("missing") } as never);

      const res = await GET();

      expect(res.status).toBe(404);
      expect(mockGetThreadAttention).not.toHaveBeenCalled();
    });

    test("returns 500 when the lookup fails", async () => {
      mockGetThreadAttention.mockResolvedValueOnce({ data: null, error: new Error("db") } as never);

      const res = await GET();

      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/chats/[id]/seen", () => {
    test("marks the thread seen for the signed-in owner", async () => {
      const res = await POST(new Request("http://localhost/api/chats/t1/seen"), seenParams("t1"));

      expect(res.status).toBe(200);
      expect(mockMarkThreadSeen).toHaveBeenCalledWith({ threadId: "t1", ownerId: "sb_test_user" });
    });

    test("returns 401 when the user is not authenticated", async () => {
      mockAuth.mockResolvedValueOnce({ userId: null } as never);

      const res = await POST(new Request("http://localhost/api/chats/t1/seen"), seenParams("t1"));

      expect(res.status).toBe(401);
      expect(mockMarkThreadSeen).not.toHaveBeenCalled();
    });

    test("returns 429 when the activity limit is exceeded", async () => {
      mockCheckChatsActivityLimit.mockResolvedValueOnce({ success: false } as never);

      const res = await POST(new Request("http://localhost/api/chats/t1/seen"), seenParams("t1"));

      expect(res.status).toBe(429);
      expect(mockMarkThreadSeen).not.toHaveBeenCalled();
    });

    test("returns 500 when the write fails", async () => {
      mockMarkThreadSeen.mockResolvedValueOnce({ ok: false, error: new Error("rls") } as never);

      const res = await POST(new Request("http://localhost/api/chats/t1/seen"), seenParams("t1"));

      expect(res.status).toBe(500);
    });
  });
});
