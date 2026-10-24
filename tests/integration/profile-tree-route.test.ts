// @ts-nocheck
import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";

const sampleTree = {
  headline: "Builder of thoughtful AI tools",
  signature: "Building calm, useful AI systems.",
  sections: [
    {
      id: "about",
      title: "About",
      body: "A concise profile body.",
    },
  ],
};

const updatedTree = {
  ...sampleTree,
  headline: "Updated headline",
};

const mockAuth = mock(createMockAuth());
const mockGetProfileTreeForCurrentUser = mock(async () => ({
  data: { tree: sampleTree, source: "llm-generated", updatedAt: "2026-04-24T00:00:00.000Z" },
  error: null,
}));
const mockUpsertProfileTreeForCurrentUser = mock(async () => ({ data: undefined, error: null }));
const mockPatchProfileTreeFieldsForCurrentUser = mock(async () => ({
  data: updatedTree,
  error: null,
}));
const mockCheckProfileTreeEditLimit = mock(async () => ({ success: true, remaining: 100 }));

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("@/data/supabase/profiles", () => ({
  getProfileTreeForCurrentUser: mockGetProfileTreeForCurrentUser,
  upsertProfileTreeForCurrentUser: mockUpsertProfileTreeForCurrentUser,
  patchProfileTreeFieldsForCurrentUser: mockPatchProfileTreeFieldsForCurrentUser,
}));

mock.module("@/lib/rate-limit/profile", () => ({
  checkProfileTreeEditLimit: mockCheckProfileTreeEditLimit,
}));

import { GET, PATCH, POST } from "@/app/api/profile/tree/route";

describe("/api/profile/tree", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetProfileTreeForCurrentUser.mockClear();
    mockUpsertProfileTreeForCurrentUser.mockClear();
    mockPatchProfileTreeFieldsForCurrentUser.mockClear();
    mockCheckProfileTreeEditLimit.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGetProfileTreeForCurrentUser.mockResolvedValue({
      data: { tree: sampleTree, source: "llm-generated", updatedAt: "2026-04-24T00:00:00.000Z" },
      error: null,
    });
    mockUpsertProfileTreeForCurrentUser.mockResolvedValue({ data: undefined, error: null });
    mockPatchProfileTreeFieldsForCurrentUser.mockResolvedValue({
      data: updatedTree,
      error: null,
    });
    mockCheckProfileTreeEditLimit.mockResolvedValue({ success: true, remaining: 100 });
  });

  test("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockGetProfileTreeForCurrentUser).not.toHaveBeenCalled();
  });

  test("GET returns the persisted profile tree payload", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.tree).toEqual(sampleTree);
    expect(body.data.source).toBe("llm-generated");
  });

  test("POST saves a tailored seed tree", async () => {
    const res = await POST(
      new Request("http://localhost/api/profile/tree", {
        method: "POST",
        body: JSON.stringify({ tree: sampleTree }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: sampleTree });
    expect(mockUpsertProfileTreeForCurrentUser).toHaveBeenCalledWith(sampleTree, "tailored-seed");
  });

  test("PATCH rejects invalid payloads", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/profile/tree", {
        method: "PATCH",
        body: JSON.stringify({ headline: "" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid profile update" });
    expect(mockPatchProfileTreeFieldsForCurrentUser).not.toHaveBeenCalled();
  });

  test("PATCH rate limits profile edits", async () => {
    mockCheckProfileTreeEditLimit.mockResolvedValueOnce({
      success: false,
      error: "Too many profile edits",
    });

    const res = await PATCH(
      new Request("http://localhost/api/profile/tree", {
        method: "PATCH",
        body: JSON.stringify({ headline: "Updated headline" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body).toEqual({ error: "Too many profile edits" });
    expect(mockPatchProfileTreeFieldsForCurrentUser).not.toHaveBeenCalled();
  });

  test("PATCH updates only editable profile fields", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/profile/tree", {
        method: "PATCH",
        body: JSON.stringify({ headline: "Updated headline" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: updatedTree });
    expect(mockPatchProfileTreeFieldsForCurrentUser).toHaveBeenCalledWith({
      headline: "Updated headline",
    });
  });
});
