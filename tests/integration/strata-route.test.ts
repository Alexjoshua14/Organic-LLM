import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockAuth = mock(async () => ({ userId: "user_123" }));
const mockGetSupabaseUserId = mock(async () => ({ data: "sb-user", error: null }));
const mockGetStrataPageById = mock(async () => ({
  page: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "My Strata",
    owner_id: "sb-user",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  sections: {
    raw_text: { key: "raw_text", content: "raw", contentJson: null },
    refined_text: { key: "refined_text", content: "", contentJson: null },
    elaborated: { key: "elaborated", content: "", contentJson: null },
    design_instructions: { key: "design_instructions", content: "design", contentJson: null },
    ai_instructions: { key: "ai_instructions", content: "ai", contentJson: null },
  },
}));
const mockGenerateObject = mock(async () => ({
  object: {
    refinedTitle: "Refined test heading",
    refinedText: "refined",
    elaborated: "elaborated",
    elaboratedArtifacts: { kind: "text" },
  },
}));
const mockGenerateText = mock(async () => ({
  text: "- memory: none\n- graph: none",
}));
const mockCreateStrataMemorySearchTool = mock(() => ({ __tool: "search_memories" }));
const mockCreateStrataKnowledgeGraphTools = mock(() => ({
  create_knowledge_node: { __tool: "create_knowledge_node" },
  update_knowledge_node: { __tool: "update_knowledge_node" },
  search_knowledge_nodes: { __tool: "search_knowledge_nodes" },
  traverse_knowledge_graph: { __tool: "traverse_knowledge_graph" },
}));

mock.module("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}));

mock.module("server-only", () => ({}));

mock.module("@/data/supabase/strata", () => ({
  getStrataPageById: mockGetStrataPageById,
}));

mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: mockGetSupabaseUserId,
}));

mock.module("ai", () => ({
  generateObject: mockGenerateObject,
  generateText: mockGenerateText,
}));

mock.module("@/lib/llm/strata-memory-tool", () => ({
  createStrataMemorySearchTool: mockCreateStrataMemorySearchTool,
}));

mock.module("@/lib/llm/strata-knowledge-graph-tools", () => ({
  createStrataKnowledgeGraphTools: mockCreateStrataKnowledgeGraphTools,
}));

import { POST } from "@/app/api/prototypes/strata/route";

describe("POST /api/prototypes/strata", () => {
  beforeEach(() => {
    mockAuth.mockClear();
    mockGetStrataPageById.mockClear();
    mockGenerateObject.mockClear();
    mockGenerateText.mockClear();
    mockGetSupabaseUserId.mockClear();
    mockCreateStrataMemorySearchTool.mockClear();
    mockCreateStrataKnowledgeGraphTools.mockClear();
  });

  test("returns 401 when unauthorized", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "create",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockGetSupabaseUserId).not.toHaveBeenCalled();
    expect(mockGetStrataPageById).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({ pageId: "not-a-uuid", mode: "create" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockGetStrataPageById).not.toHaveBeenCalled();
  });

  test("returns 404 when page does not exist", async () => {
    mockGetStrataPageById.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "update",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  test("returns generated sections payload on success", async () => {
    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "create",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGenerateText).toHaveBeenCalled();
    expect(mockGenerateObject).toHaveBeenCalled();
    expect(body.refinedTitle).toBe("Refined test heading");
    expect(body.refinedText).toBe("refined");
    expect(body.elaborated).toBe("elaborated");
    expect(body.rawGenerationContext.lastGeneratedRawText).toBe("raw");
    expect(body.rawGenerationContext.lastGenerationMode).toBe("create");
  });

  test("supports local snapshot generation without pageId", async () => {
    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({
        mode: "create",
        sectionsSnapshot: {
          raw_text: "local raw text",
          refined_text: "",
          elaborated: "",
          design_instructions: "design",
          ai_instructions: "ai",
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetStrataPageById).not.toHaveBeenCalled();
    expect(body.refinedText).toBe("refined");
  });

  test("injects diff context for update mode from DB generation metadata", async () => {
    mockGetStrataPageById.mockResolvedValueOnce({
      page: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "My Strata",
        owner_id: "sb-user",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      sections: {
        raw_text: {
          key: "raw_text",
          content: "new line one\nline two",
          contentJson: {
            generationContext: {
              lastGeneratedRawText: "old line one\nline two",
              lastGeneratedAt: "2026-01-01T00:00:00.000Z",
              lastGenerationMode: "create",
            },
          },
        },
        refined_text: { key: "refined_text", content: "old refined", contentJson: null },
        elaborated: { key: "elaborated", content: "old elaborated", contentJson: null },
        design_instructions: { key: "design_instructions", content: "design", contentJson: null },
        ai_instructions: { key: "ai_instructions", content: "ai", contentJson: null },
      },
    });

    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({
        pageId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "update",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    const toolingCall = mockGenerateText.mock.calls.at(-1)?.[0] as { prompt?: string };
    expect(toolingCall.prompt).toContain("Raw input delta context");
    expect(toolingCall.prompt).toContain("Previous generation raw text");
    expect(toolingCall.prompt).toContain("Current raw text");
    expect(toolingCall.prompt).toContain("Diff summary");
    expect(body.rawGenerationContext.lastGenerationMode).toBe("update");
    expect(body.rawGenerationContext.lastRawDiffSummary).toContain("Line-level diff summary");
  });

  test("supports local snapshot update with raw generation metadata", async () => {
    const req = new Request("http://localhost/api/prototypes/strata", {
      method: "POST",
      body: JSON.stringify({
        mode: "update",
        sectionsSnapshot: {
          raw_text: "current local raw",
          refined_text: "prior refined",
          elaborated: "prior elaborated",
          design_instructions: "design",
          ai_instructions: "ai",
        },
        rawGenerationMetadata: {
          generationContext: {
            lastGeneratedRawText: "previous local raw",
            lastGeneratedAt: "2026-01-01T00:00:00.000Z",
            lastGenerationMode: "create",
          },
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetStrataPageById).not.toHaveBeenCalled();
    const toolingCall = mockGenerateText.mock.calls.at(-1)?.[0] as { prompt?: string };
    expect(toolingCall.prompt).toContain("previous local raw");
    expect(toolingCall.prompt).toContain("current local raw");
    expect(body.rawGenerationContext.lastGenerationMode).toBe("update");
  });
});
