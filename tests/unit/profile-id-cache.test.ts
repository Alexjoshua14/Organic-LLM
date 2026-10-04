import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const mockGetSupabaseUserId = mock(async (_clerkId: string) => ({
  data: "sb_1" as string | null,
  error: null as Error | null,
}));

mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
}));

const { clearSupabaseUserIdCache, getSupabaseUserIdCached } = await import(
  "@/data/supabase/profile-id-cache"
);

describe("getSupabaseUserIdCached", () => {
  beforeEach(() => {
    clearSupabaseUserIdCache();
    mockGetSupabaseUserId.mockClear();
    mockGetSupabaseUserId.mockResolvedValue({ data: "sb_1", error: null });
  });

  test("looks up once per Clerk user", async () => {
    expect((await getSupabaseUserIdCached("clerk_1")).data).toBe("sb_1");
    expect((await getSupabaseUserIdCached("clerk_1")).data).toBe("sb_1");
    expect(mockGetSupabaseUserId).toHaveBeenCalledTimes(1);

    await getSupabaseUserIdCached("clerk_2");
    expect(mockGetSupabaseUserId).toHaveBeenCalledTimes(2);
  });

  test("does not cache a failed lookup", async () => {
    mockGetSupabaseUserId.mockResolvedValueOnce({ data: null, error: new Error("not found") });

    expect((await getSupabaseUserIdCached("clerk_1")).error?.message).toBe("not found");
    expect((await getSupabaseUserIdCached("clerk_1")).data).toBe("sb_1");
    expect(mockGetSupabaseUserId).toHaveBeenCalledTimes(2);
  });
});
