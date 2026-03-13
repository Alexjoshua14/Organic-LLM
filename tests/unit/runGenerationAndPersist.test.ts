import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NODE_ID = "660e8400-e29b-41d4-a716-446655440001";

const mockGetSessionById = mock(async () => ({ data: null, error: null }));
const mockSaveSession = mock(async () => ({ ok: true, error: null }));
const mockGenerateRabbitHoleNode = mock(async () => ({
  data: null,
  error: new Error("Generation failed"),
}));

let updatePayload: Record<string, unknown> | null = null;
let eqColumn: string | null = null;
let eqValue: string | null = null;

const createSupabaseMock = () => ({
  from: (table: string) => {
    if (table !== "rabbit_hole_sessions") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      update: (data: Record<string, unknown>) => {
        updatePayload = data;
        return {
          eq: (column: string, value: string) => {
            eqColumn = column;
            eqValue = value;
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  },
});

const mockSupabaseServer = mock(async () => createSupabaseMock());

mock.module("@/lib/supabase/server", () => ({
  supabaseServer: mockSupabaseServer,
}));
mock.module("@/data/supabase/rabbitholes", () => ({
  getSessionById: mockGetSessionById,
  saveSession: mockSaveSession,
}));
mock.module("@/lib/rabbit-holes/actions", () => ({
  generateRabbitHoleNode: mockGenerateRabbitHoleNode,
}));

const { clearGeneratingNodeId, runGenerationAndPersist } = await import(
  "@/lib/rabbit-holes/runGenerationAndPersist"
);

beforeEach(() => {
  updatePayload = null;
  eqColumn = null;
  eqValue = null;
  mockGetSessionById.mockReset();
  mockSaveSession.mockReset();
  mockSaveSession.mockResolvedValue({ ok: true, error: null });
  mockGenerateRabbitHoleNode.mockReset();
  mockSupabaseServer.mockReset();
  mockSupabaseServer.mockResolvedValue(createSupabaseMock());
});

afterEach(() => {
  updatePayload = null;
  eqColumn = null;
  eqValue = null;
});

describe("clearGeneratingNodeId", () => {
  test("updates rabbit_hole_sessions with generating_node_id null for session_id", async () => {
    await clearGeneratingNodeId(SESSION_ID);

    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(eqColumn).toBe("session_id");
    expect(eqValue).toBe(SESSION_ID);
  });
});

describe("runGenerationAndPersist", () => {
  test("clears generating_node_id when session is not found", async () => {
    mockGetSessionById.mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    } as any);

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockGetSessionById.mock.calls.length).toBe(1);
    expect(
      (mockGetSessionById.mock.calls as unknown as Array<[string]>)[0]?.[0],
    ).toBe(SESSION_ID);
    expect(mockGenerateRabbitHoleNode.mock.calls.length).toBe(0);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(eqValue).toBe(SESSION_ID);
  });

  test("clears generating_node_id when node already has content", async () => {
    const sessionWithContent = {
      sessionId: SESSION_ID,
      rootQuestion: "Q",
      path: [{ nodeId: NODE_ID, label: "L", parentNodeId: null }],
      nodesById: {
        [NODE_ID]: {
          id: NODE_ID,
          rawPrompt: "P",
          userQuestion: "Q",
          keyTakeaways: ["A", "B", "C"],
          articleHtml: "<p>Done</p>",
          sources: [],
          branchSuggestions: [],
          createdAt: new Date().toISOString(),
        },
      },
      activeNodeId: NODE_ID,
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockGetSessionById.mockResolvedValue({
      data: sessionWithContent,
      error: null,
    } as any);

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockGenerateRabbitHoleNode.mock.calls.length).toBe(0);
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(mockSaveSession.mock.calls.length).toBe(0);
  });

  test("saves session with generatingNodeId null when generation succeeds", async () => {
    const emptyNodeSession = {
      sessionId: SESSION_ID,
      rootQuestion: "Q",
      path: [{ nodeId: NODE_ID, label: "L", parentNodeId: null }],
      nodesById: {
        [NODE_ID]: {
          id: NODE_ID,
          rawPrompt: "P",
          userQuestion: "Q",
          keyTakeaways: ["Generating…", "…", "…"],
          articleHtml: "",
          sources: [],
          branchSuggestions: [],
          createdAt: new Date().toISOString(),
        },
      },
      activeNodeId: NODE_ID,
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedSession = {
      ...emptyNodeSession,
      nodesById: {
        [NODE_ID]: {
          ...emptyNodeSession.nodesById[NODE_ID],
          articleHtml: "<p>Content</p>",
          keyTakeaways: ["K1", "K2", "K3"],
        },
      },
    };
    mockGetSessionById.mockResolvedValue({
      data: emptyNodeSession,
      error: null,
    } as any);
    mockGenerateRabbitHoleNode.mockResolvedValue({
      data: updatedSession,
      error: null,
    } as any);

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockGenerateRabbitHoleNode.mock.calls.length).toBe(1);
    const genCalls = mockGenerateRabbitHoleNode.mock.calls as unknown as Array<
      [typeof emptyNodeSession, string]
    >;
    expect(genCalls[0]?.[0]).toBe(emptyNodeSession);
    expect(genCalls[0]?.[1]).toBe(NODE_ID);
    expect(mockSaveSession.mock.calls.length).toBe(1);
    const firstCall = (mockSaveSession.mock.calls as unknown as Array<[string]>)[0]!;
    const serialized = firstCall[0];
    const saved = JSON.parse(serialized) as { generatingNodeId: string | null };
    expect(saved.generatingNodeId).toBeNull();
  });

  test("clears generating_node_id when generation fails", async () => {
    const emptyNodeSession = {
      sessionId: SESSION_ID,
      rootQuestion: "Q",
      path: [{ nodeId: NODE_ID, label: "L", parentNodeId: null }],
      nodesById: {
        [NODE_ID]: {
          id: NODE_ID,
          rawPrompt: "P",
          userQuestion: "Q",
          keyTakeaways: ["Generating…", "…", "…"],
          articleHtml: "",
          sources: [],
          branchSuggestions: [],
          createdAt: new Date().toISOString(),
        },
      },
      activeNodeId: NODE_ID,
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockGetSessionById.mockResolvedValue({
      data: emptyNodeSession,
      error: null,
    } as any);
    mockGenerateRabbitHoleNode.mockResolvedValue({
      data: null,
      error: new Error("LLM error"),
    } as any);

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockSaveSession.mock.calls.length).toBe(0);
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(eqValue).toBe(SESSION_ID);
  });
});
