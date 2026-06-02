// @ts-nocheck
import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createMockAuth, createMockClerkUser } from "../helpers/mock-auth";

const samplePlan = {
  headlineDirection: "Memory-aware systems builder",
  roles: ["Software engineer", "Creative technologist"],
  signatureDirection: "Building tools that externalize metacognition.",
  sections: [
    {
      id: "about",
      title: "About",
      purpose: "Summarize identity and current direction.",
      memoryQueries: ["identity current work"],
      desiredShape: "body",
      priority: 10,
    },
    {
      id: "tech",
      title: "Tech",
      purpose: "Capture technical systems and projects.",
      memoryQueries: ["technical projects AI systems"],
      desiredShape: "body-items",
      priority: 9,
    },
    {
      id: "lifestyle",
      title: "Lifestyle & Interests",
      purpose: "Capture lifestyle and interests.",
      memoryQueries: ["lifestyle cooking interests"],
      desiredShape: "items",
      priority: 7,
    },
  ],
};

const generatedSections = {
  about: {
    id: "about",
    title: "About",
    body: "Systems-minded engineer building memory-aware AI tools.",
  },
  tech: {
    id: "tech",
    title: "Tech",
    body: "Builds Organic LLM and related AI systems with a focus on orchestration.",
    items: ["Memory-aware systems", "Full-stack architecture"],
  },
  lifestyle: {
    id: "lifestyle",
    title: "Lifestyle & Interests",
    items: ["Cooking", "Specialty coffee", "Systems thinking"],
  },
};

const sampleTree = {
  headline: samplePlan.headlineDirection,
  roles: samplePlan.roles,
  signature: samplePlan.signatureDirection,
  sections: [generatedSections.about, generatedSections.tech, generatedSections.lifestyle],
};

const mockAuth = mock(createMockAuth());
const mockGenerateText = mock(async ({ prompt }) => {
  if (String(prompt).includes('"id":"about"')) {
    return { text: JSON.stringify(generatedSections.about), usage: { inputTokens: 1000, outputTokens: 120 } };
  }
  if (String(prompt).includes('"id":"tech"')) {
    return { text: JSON.stringify(generatedSections.tech), usage: { inputTokens: 1000, outputTokens: 160 } };
  }

  return { text: JSON.stringify(generatedSections.lifestyle), usage: { inputTokens: 1000, outputTokens: 120 } };
});
const mockGenerateObject = mock(async ({ prompt }) => {
  const promptText = String(prompt);

  if (promptText.includes("Plan the ideal ProfileTree sections")) {
    return { object: samplePlan, usage: { inputTokens: 2500, outputTokens: 500 } };
  }
  if (promptText.includes("Review every generated section")) {
    return {
      object: {
        overallScore: 0.84,
        sections: samplePlan.sections.map((section) => ({
          sectionId: section.id,
          score: 0.84,
          decision: "accept",
          issues: [],
        })),
      },
      usage: { inputTokens: 3500, outputTokens: 500 },
    };
  }

  return {
    object: {
      score: 0.86,
      decision: "accept",
      weakSectionIds: [],
      issues: [],
    },
    usage: { inputTokens: 2200, outputTokens: 260 },
  };
});
const mockGetSupabaseUserId = mock(async () => ({
  data: "sb_test_user",
  error: null,
}));
const mockCreateProfileTreeRevision = mock(async () => ({
  data: { revisionId: "revision-1" },
  error: null,
}));
const mockSearchMemoriesForUser = mock(async () => ({
  data: {
    results: [
      {
        id: "memory-1",
        memory: "Alex builds memory-aware AI tools.",
        score: 0.91,
      },
      {
        id: "memory-2",
        memory: "Alex cares about design-forward interfaces and cooking.",
        score: 0.82,
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
  createProfileTreeRevisionForCurrentUser: mockCreateProfileTreeRevision,
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
  createLogger: () => ({
    log: mock(() => undefined),
    debug: mock(() => undefined),
    warn: mock(() => undefined),
    error: mock(() => undefined),
  }),
}));

import { POST } from "@/app/api/profile/summary/route";

describe("POST /api/profile/summary", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGenerateText.mockClear();
    mockGenerateObject.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockCreateProfileTreeRevision.mockClear();
    mockSearchMemoriesForUser.mockClear();
    mockCheckProfileTreeGenerationLimit.mockClear();
    mockRecordLlmCall.mockClear();

    mockAuth.mockResolvedValue(createMockClerkUser());
    mockGenerateText.mockImplementation(async ({ prompt }) => {
      if (String(prompt).includes('"id":"about"')) {
        return {
          text: JSON.stringify(generatedSections.about),
          usage: { inputTokens: 1000, outputTokens: 120 },
        };
      }
      if (String(prompt).includes('"id":"tech"')) {
        return {
          text: JSON.stringify(generatedSections.tech),
          usage: { inputTokens: 1000, outputTokens: 160 },
        };
      }

      return {
        text: JSON.stringify(generatedSections.lifestyle),
        usage: { inputTokens: 1000, outputTokens: 120 },
      };
    });
    mockGenerateObject.mockImplementation(async ({ prompt }) => {
      const promptText = String(prompt);

      if (promptText.includes("Plan the ideal ProfileTree sections")) {
        return { object: samplePlan, usage: { inputTokens: 2500, outputTokens: 500 } };
      }
      if (promptText.includes("Review every generated section")) {
        return {
          object: {
            overallScore: 0.84,
            sections: samplePlan.sections.map((section) => ({
              sectionId: section.id,
              score: 0.84,
              decision: "accept",
              issues: [],
            })),
          },
          usage: { inputTokens: 3500, outputTokens: 500 },
        };
      }

      return {
        object: {
          score: 0.86,
          decision: "accept",
          weakSectionIds: [],
          issues: [],
        },
        usage: { inputTokens: 2200, outputTokens: 260 },
      };
    });
    mockGetSupabaseUserId.mockResolvedValue({ data: "sb_test_user", error: null });
    mockCreateProfileTreeRevision.mockResolvedValue({
      data: { revisionId: "revision-1" },
      error: null,
    });
    mockSearchMemoriesForUser.mockResolvedValue({
      data: {
        results: [
          { id: "memory-1", memory: "Alex builds memory-aware AI tools.", score: 0.91 },
          {
            id: "memory-2",
            memory: "Alex cares about design-forward interfaces and cooking.",
            score: 0.82,
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

  test("orchestrates planner, sections, review, revision, and returns a ProfileTree", async () => {
    const res = await POST(
      new Request("http://localhost/api/profile/summary", {
        method: "POST",
        body: JSON.stringify({ displayName: "Alex", email: "alex@example.com" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(sampleTree);
    expect(body.revisionId).toBe("revision-1");
    expect(body.revisionStatus).toBe("active");
    expect(mockSearchMemoriesForUser).toHaveBeenCalledWith(
      "sb_test_user",
      expect.stringContaining("profile biography"),
      { limit: 50 }
    );
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5.5",
        schemaName: "ProfileSectionPlan",
        prompt: expect.stringContaining("Plan the ideal ProfileTree sections"),
      })
    );
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5.5",
        schemaName: "ProfileSectionBatchReview",
      })
    );
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5.5",
        schemaName: "ProfileTreeReview",
      })
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
    expect(mockCreateProfileTreeRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        tree: sampleTree,
        source: "llm-generated",
        status: "active",
        reviewScore: 0.86,
      })
    );
    expect(mockRecordLlmCall).toHaveBeenCalled();
  });

  test("fails quickly when memory search is unavailable", async () => {
    mockSearchMemoriesForUser.mockResolvedValueOnce({
      data: null,
      error: "Memory service may be unavailable.",
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toContain("Memory search is unavailable");
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockCreateProfileTreeRevision).not.toHaveBeenCalled();
  });

  test("fails quickly when no relevant memories are available", async () => {
    mockSearchMemoriesForUser.mockResolvedValueOnce({
      data: {
        results: [{ id: "memory-low", memory: "A weakly related memory.", score: 0.2 }],
      },
      error: null,
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("could not find enough relevant memories");
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockCreateProfileTreeRevision).not.toHaveBeenCalled();
  });

  test("rewrites a weak high-priority section exactly once", async () => {
    let aboutCalls = 0;

    mockGenerateText.mockImplementation(async ({ prompt }) => {
      if (String(prompt).includes('"id":"about"')) {
        aboutCalls += 1;

        return {
          text: JSON.stringify({
            ...generatedSections.about,
            body: aboutCalls === 1 ? "Generic builder." : "Memory-aware systems engineer.",
          }),
          usage: { inputTokens: 1000, outputTokens: 120 },
        };
      }
      if (String(prompt).includes('"id":"tech"')) {
        return { text: JSON.stringify(generatedSections.tech), usage: {} };
      }

      return { text: JSON.stringify(generatedSections.lifestyle), usage: {} };
    });
    mockGenerateObject.mockImplementation(async ({ prompt }) => {
      const promptText = String(prompt);

      if (promptText.includes("Plan the ideal ProfileTree sections")) {
        return { object: samplePlan, usage: {} };
      }
      if (promptText.includes("Review every generated section")) {
        return {
          object: {
            overallScore: 0.7,
            sections: [
              {
                sectionId: "about",
                score: 0.6,
                decision: "revise",
                issues: ["Too generic"],
                rewriteInstructions: "Use concrete memory-backed identity.",
              },
              { sectionId: "tech", score: 0.84, decision: "accept", issues: [] },
              { sectionId: "lifestyle", score: 0.84, decision: "accept", issues: [] },
            ],
          },
          usage: {},
        };
      }

      return { object: { score: 0.8, decision: "accept", weakSectionIds: [], issues: [] }, usage: {} };
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));

    expect(res.status).toBe(200);
    expect(aboutCalls).toBe(2);
    expect(mockCreateProfileTreeRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMetadata: expect.objectContaining({
          sectionStates: expect.arrayContaining([
            expect.objectContaining({ sectionId: "about", status: "revised" }),
          ]),
        }),
      })
    );
  });

  test("persists low-quality partial output as failed revision without publishing", async () => {
    mockGenerateObject.mockImplementation(async ({ prompt }) => {
      const promptText = String(prompt);

      if (promptText.includes("Plan the ideal ProfileTree sections")) {
        return { object: samplePlan, usage: {} };
      }
      if (promptText.includes("Review every generated section")) {
        return {
          object: {
            overallScore: 0.84,
            sections: samplePlan.sections.map((section) => ({
              sectionId: section.id,
              score: 0.84,
              decision: "accept",
              issues: [],
            })),
          },
          usage: {},
        };
      }

      return {
        object: {
          score: 0.6,
          decision: "revise",
          weakSectionIds: ["about"],
          issues: ["Unsupported claims"],
        },
        usage: {},
      };
    });

    const res = await POST(new Request("http://localhost/api/profile/summary"));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.revisionStatus).toBe("failed");
    expect(mockCreateProfileTreeRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        source: "partial-generated",
      })
    );
  });
});
