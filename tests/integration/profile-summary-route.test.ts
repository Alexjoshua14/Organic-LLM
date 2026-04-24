// @ts-nocheck
import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";

const sampleTree = {
  headline: "Builder of thoughtful AI tools",
  roles: ["Software engineer"],
  signature: "Building calm, useful AI systems.",
  sections: [
    {
      id: "about",
      title: "About",
      body: "A concise profile body.",
    },
  ],
};

const mockAuth = mock(createMockAuth());
const mockGenerateText = mock(async () => ({
  text: "- User likes thoughtful AI systems.",
  usage: { promptTokens: 5, completionTokens: 7 },
}));
const mockGenerateObject = mock(async () => ({
  object: sampleTree,
  usage: { promptTokens: 10, completionTokens: 20 },
}));
const mockGetSupabaseUserId = mock(async () => ({
  data: "sb_test_user",
  error: null,
}));
const mockUpsertProfileTree = mock(async () => ({ data: undefined, error: null }));
const mockSearchMemoriesForUser = mock(async () => ({
  data: {
    results: [
      {
        id: "memory-1",
        memory: "Alex builds memory-aware AI tools.",
        score: 0.91,
      },
    ],
  },
  error: null,
}));
const mockCheckProfileTreeGenerationLimit = mock(async () => ({ success: true, remaining: 5 }));
const mockRecordLlmCall = mock(() => undefined);

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("ai", () => ({
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
  stepCountIs: mock((count: number) => ({ stepCount: count })),
  tool: mock((definition: unknown) => definition),
}));

mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
  upsertProfileTreeForCurrentUser: mockUpsertProfileTree,
}));

mock.module("@/lib/memory/operations", () => ({
  searchMemoriesForUser: mockSearchMemoriesForUser,
}));

mock.module("@/lib/rate-limit/profile", () => ({
  checkProfileTreeGenerationLimit: mockCheckProfileTreeGenerationLimit,
}));

mock.module("@/lib/llm/metrics", () => ({
  recordLlmCall: mockRecordLlmCall,
}));

mock.module("@/lib/logger", () => ({
  createLogger: () => ({ error: mock(() => undefined) }),
}));

import { POST } from "@/app/api/profile/summary/route";

describe("POST /api/profile/summary", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGenerateText.mockClear();
    mockGenerateObject.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockUpsertProfileTree.mockClear();
    mockSearchMemoriesForUser.mockClear();
    mockCheckProfileTreeGenerationLimit.mockClear();
    mockRecordLlmCall.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGenerateText.mockResolvedValue({
      text: "- User likes thoughtful AI systems.",
      usage: { promptTokens: 5, completionTokens: 7 },
    });
    mockGenerateObject.mockResolvedValue({
      object: sampleTree,
      usage: { promptTokens: 10, completionTokens: 20 },
    });
    mockGetSupabaseUserId.mockResolvedValue({
      data: "sb_test_user",
      error: null,
    });
    mockUpsertProfileTree.mockResolvedValue({ data: undefined, error: null });
    mockSearchMemoriesForUser.mockResolvedValue({
      data: {
        results: [
          {
            id: "memory-1",
            memory: "Alex builds memory-aware AI tools.",
            score: 0.91,
          },
        ],
      },
      error: null,
    });
    mockCheckProfileTreeGenerationLimit.mockResolvedValue({ success: true, remaining: 5 });
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockGetSupabaseUserId).not.toHaveBeenCalled();
  });

  test("returns 429 when generation limit is exceeded", async () => {
    mockCheckProfileTreeGenerationLimit.mockResolvedValueOnce({
      success: false,
      error: "Profile generation is limited",
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain("Profile generation");
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockGetSupabaseUserId).not.toHaveBeenCalled();
  });

  test("returns 404 when the Clerk user has no Supabase profile", async () => {
    mockGetSupabaseUserId.mockResolvedValueOnce({
      data: null,
      error: new Error("not found"),
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "User not found" });
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  test("rejects invalid request body", async () => {
    const res = await POST(
      new Request("http://localhost/api/profile/summary", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid profile generation request" });
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  test("generates, persists, and returns a ProfileTree", async () => {
    const res = await POST(
      new Request("http://localhost/api/profile/summary", {
        method: "POST",
        body: JSON.stringify({ displayName: "Alex", email: "alex@example.com" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: sampleTree });
    expect(mockSearchMemoriesForUser).toHaveBeenCalledWith(
      "sb_test_user",
      expect.stringContaining("profile biography"),
      { limit: 50 }
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          search_memories: expect.objectContaining({
            inputSchema: expect.anything(),
          }),
        }),
      })
    );
    expect(mockUpsertProfileTree).toHaveBeenCalledWith(sampleTree, "llm-generated");
    expect(mockRecordLlmCall).toHaveBeenCalledTimes(2);
  });

  test("returns 500 when generation fails", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("model down"));

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to generate profile tree" });
  });

  test("returns 500 when persistence fails", async () => {
    mockUpsertProfileTree.mockResolvedValueOnce({
      data: null,
      error: new Error("db down"),
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Failed to save profile tree" });
  });
});
