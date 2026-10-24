// @ts-nocheck
import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";

const sampleProfile = {
  clerk_user_id: "user_123",
  display_name: "Alex",
  email: "alex@example.com",
  profile_tree: null,
  profile_tree_source: null,
  profile_tree_updated_at: null,
};

const mockAuth = mock(createMockAuth());
const mockGetProfile = mock(async () => ({
  data: sampleProfile,
  error: null,
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("@/data/supabase/profiles", () => ({
  getProfile: mockGetProfile,
}));

import { GET } from "@/app/api/profile/route";

describe("GET /api/profile", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetProfile.mockClear();
    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetProfile.mockResolvedValue({ data: sampleProfile, error: null });
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  test("returns profile data for the signed-in user", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(sampleProfile);
    expect(mockGetProfile).toHaveBeenCalledWith("clerk_test_user");
  });

  test("returns 404 when profile is missing", async () => {
    mockGetProfile.mockResolvedValue({ data: null, error: new Error("Profile not found") });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Profile not found");
  });
});
