import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

// Prevent any transitive load of Redis from making network calls in CI
mock.module("@upstash/redis", () => ({
  Redis: class {
    request = () => Promise.resolve({ data: undefined, error: null });
  },
}));
mock.module("@/lib/redis/redis", () => ({
  redis: { request: () => Promise.resolve({ data: undefined, error: null }) },
}));

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NODE_ID = "660e8400-e29b-41d4-a716-446655440001";

const mockGetSessionById = mock(async () => ({ data: null, error: null }));
const mockSaveSession = mock(async () => ({ ok: true, error: null }));
const mockAdvanceGenerationStep = mock(async () => ({ updated: true }));
const mockRunOneGenerationStep = mock(async () => ({
  data: null,
  error: new Error("Step failed"),
}));

let updatePayload: Record<string, unknown> | null = null;
let eqColumn: string | null = null;
let eqValue: string | null = null;

// clearGeneratingNodeId chains: from().update().eq("session_id", sessionId) and awaits.
// Real Supabase returns a thenable from .eq(); mock must match so await resolves to { data, error }.
const createSupabaseMock = () => ({
  from: (table: string) => {
    if (table !== "rabbit_hole_sessions") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      update: (data: Record<string, unknown>) => {
        updatePayload = data;
        return {
          eq: (_column: string, value: string) => {
            eqColumn = _column;
            eqValue = value;
            return Promise.resolve({
              data: { session_id: SESSION_ID },
              error: null,
            });
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
mock.module("@/lib/supabase/supabase-admin", () => ({
  supabaseAdmin: createSupabaseMock(),
}));
// actions is mocked in preload so real module never loads (avoids CI "Export not found" for "use server"). We wire our mock via globalThis.
const setActionsHandler = () => {
  (globalThis as unknown as { __runOneGenerationStepHandler: typeof mockRunOneGenerationStep }).__runOneGenerationStepHandler =
    mockRunOneGenerationStep;
};

let clearGeneratingNodeId: (sessionId: string) => Promise<void>;
let runGenerationAndPersist: (sessionId: string, nodeId: string) => Promise<void>;

describe("with mocked rabbitholes", () => {
  beforeAll(async () => {
    setActionsHandler();
    const real = (globalThis as unknown as { __realRabbitholes: typeof import("@/data/supabase/rabbitholes") })
      .__realRabbitholes;
    mock.module("@/data/supabase/rabbitholes", () => ({
      ...real,
      getSessionById: mockGetSessionById,
      saveSession: mockSaveSession,
      advanceGenerationStep: mockAdvanceGenerationStep,
    }));
    const mod = await import("@/lib/rabbit-holes/runGenerationAndPersist");
    clearGeneratingNodeId = mod.clearGeneratingNodeId;
    runGenerationAndPersist = mod.runGenerationAndPersist;
  });

  beforeEach(() => {
    updatePayload = null;
    eqColumn = null;
    eqValue = null;
    mockGetSessionById.mockReset();
    mockSaveSession.mockReset();
    mockSaveSession.mockResolvedValue({ ok: true, error: null });
    mockAdvanceGenerationStep.mockReset();
    mockAdvanceGenerationStep.mockResolvedValue({ updated: true });
    mockRunOneGenerationStep.mockReset();
    mockSupabaseServer.mockReset();
    mockSupabaseServer.mockResolvedValue(createSupabaseMock());
  });

  afterEach(() => {
    updatePayload = null;
    eqColumn = null;
    eqValue = null;
  });

  describe("clearGeneratingNodeId", () => {
    test("clears generating_node_id and generation_step for session_id", async () => {
      await clearGeneratingNodeId(SESSION_ID);

      expect(updatePayload).not.toBeNull();
      expect(updatePayload!.generating_node_id).toBeNull();
      expect(updatePayload!.generation_step).toBeNull();
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
    expect(mockRunOneGenerationStep.mock.calls.length).toBe(0);
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

    expect(mockRunOneGenerationStep.mock.calls.length).toBe(0);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(mockSaveSession.mock.calls.length).toBe(0);
    });

    test("clears generating_node_id when node is not in session", async () => {
      const otherNodeId = "770e8400-e29b-41d4-a716-446655440002";
      const sessionWithoutNode = {
        sessionId: SESSION_ID,
        rootQuestion: "Q",
        path: [{ nodeId: otherNodeId, label: "L", parentNodeId: null }],
        nodesById: {
          [otherNodeId]: {
            id: otherNodeId,
            rawPrompt: "P",
            userQuestion: "Q",
            keyTakeaways: [],
            articleHtml: "",
            sources: [],
            branchSuggestions: [],
            createdAt: new Date().toISOString(),
          },
        },
        activeNodeId: otherNodeId,
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockGetSessionById.mockResolvedValue({
        data: sessionWithoutNode,
        error: null,
      } as any);

      await runGenerationAndPersist(SESSION_ID, NODE_ID);

      expect(mockGetSessionById.mock.calls.length).toBe(1);
      expect(mockRunOneGenerationStep.mock.calls.length).toBe(0);
      expect(updatePayload).not.toBeNull();
      expect(updatePayload!.generating_node_id).toBeNull();
      expect(eqColumn).toBe("session_id");
      expect(eqValue).toBe(SESSION_ID);
    });

    test("runs steps (sources, article, branches), saves three times, and advances step", async () => {
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
      generationStep: "sources" as const,
    };
    const sessionAfterSources = {
      ...emptyNodeSession,
      nodesById: {
        [NODE_ID]: {
          ...emptyNodeSession.nodesById[NODE_ID],
          sources: [
            {
              id: "s1",
              title: "S",
              url: "https://example.com/",
              status: "none" as const,
            },
          ],
          articleHtml: "",
        },
      },
    };
    const sessionAfterArticle = {
      ...sessionAfterSources,
      nodesById: {
        [NODE_ID]: {
          ...sessionAfterSources.nodesById[NODE_ID],
          articleHtml: "<p>Content</p>",
          keyTakeaways: ["K1", "K2", "K3"],
        },
      },
    };
    const sessionAfterBranches = {
      ...sessionAfterArticle,
      nodesById: {
        [NODE_ID]: {
          ...sessionAfterArticle.nodesById[NODE_ID],
          branchSuggestions: [
            { id: "b1", label: "Branch 1", shortDescription: undefined },
          ],
        },
      },
    };
    mockGetSessionById.mockResolvedValue({
      data: emptyNodeSession,
      error: null,
    } as any);
    mockRunOneGenerationStep.mockImplementation(
      (async (_session: unknown, nodeId: string, step: string) => {
        if (nodeId !== NODE_ID)
          return { data: null, error: new Error("bad node") };
        if (step === "sources")
          return { data: sessionAfterSources, error: null };
        if (step === "article")
          return { data: sessionAfterArticle, error: null };
        if (step === "branch_suggestions")
          return { data: sessionAfterBranches, error: null };
        return {
          data: null,
          error: new Error(`Unknown step: ${step}`),
        };
      }) as any,
    );

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockGetSessionById.mock.calls.length).toBe(1);
    expect(
      (mockGetSessionById.mock.calls as unknown as Array<[string, unknown]>)[0]?.[0],
    ).toBe(SESSION_ID);
    expect(mockRunOneGenerationStep.mock.calls.length).toBe(3);
    expect(mockSaveSession.mock.calls.length).toBe(3);
    expect(mockAdvanceGenerationStep.mock.calls.length).toBe(3);
    const advanceCalls = mockAdvanceGenerationStep.mock.calls as unknown as Array<
      [string, string, string, string | null, unknown]
    >;
    expect(advanceCalls[0]?.[0]).toBe(SESSION_ID);
    expect(advanceCalls[0]?.[1]).toBe(NODE_ID);
    expect(advanceCalls[0]?.[2]).toBe("sources");
    expect(advanceCalls[0]?.[3]).toBe("article");
    expect(advanceCalls[1]?.[2]).toBe("article");
    expect(advanceCalls[1]?.[3]).toBe("branch_suggestions");
    expect(advanceCalls[2]?.[2]).toBe("branch_suggestions");
    expect(advanceCalls[2]?.[3]).toBeNull();
    });

    test("exits when advanceGenerationStep returns updated false (singularity)", async () => {
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
      generationStep: "sources" as const,
    };
    const sessionAfterSources = {
      ...emptyNodeSession,
      nodesById: {
        [NODE_ID]: {
          ...emptyNodeSession.nodesById[NODE_ID],
          sources: [
            { id: "s1", title: "S", url: "https://example.com/", status: "none" as const },
          ],
          articleHtml: "",
        },
      },
    };
    mockGetSessionById.mockResolvedValue({
      data: emptyNodeSession,
      error: null,
    } as any);
    mockRunOneGenerationStep.mockResolvedValue({
      data: sessionAfterSources,
      error: null,
    } as any);
    mockAdvanceGenerationStep.mockResolvedValueOnce({ updated: false });

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockRunOneGenerationStep.mock.calls.length).toBe(1);
    expect(mockSaveSession.mock.calls.length).toBe(1);
    expect(mockAdvanceGenerationStep.mock.calls.length).toBe(1);
    });

    test("clears generating_node_id when step fails", async () => {
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
      generationStep: "sources" as const,
    };
    mockGetSessionById.mockResolvedValue({
      data: emptyNodeSession,
      error: null,
    } as any);
    mockRunOneGenerationStep.mockResolvedValue({
      data: null,
      error: new Error("LLM error"),
    } as any);

    await runGenerationAndPersist(SESSION_ID, NODE_ID);

    expect(mockSaveSession.mock.calls.length).toBe(0);
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(eqValue).toBe(SESSION_ID);
    });
  });
});
