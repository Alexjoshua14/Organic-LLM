import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { RabbitHoleContext } from "@/lib/context/rabbithole-context";
import { ensureDom } from "../helpers/render";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NODE_ID = "660e8400-e29b-41d4-a716-446655440001";

const mockFetch = mock((url: string, init?: RequestInit) => {
  return Promise.resolve(
    new Response(JSON.stringify({ error: "unmocked" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

const mockGenerateQuickPreview = mock(async () => ({
  data: "Preview text",
  error: null,
}));

const mockGetSessionById = mock(async () => ({
  data: null,
  error: null,
}));

mock.module("@/lib/rabbit-holes/actions", () => ({
  analyzeSource: mock(async () => ({ data: null, error: null })),
  generateQuickPreview: mockGenerateQuickPreview,
  generateRabbitHoleNode: mock(async () => ({
    data: null,
    error: new Error("Generation failed"),
  })),
}));

mock.module("@/data/supabase/rabbitholes", () => ({
  ...(globalThis as unknown as { __realRabbitholes: typeof import("@/data/supabase/rabbitholes") })
    .__realRabbitholes,
  getSessionById: mockGetSessionById,
  saveSession: mock(async () => ({ ok: true, error: null })),
}));

ensureDom();

const contextValue = {
  sessionId: null,
  setSessionId: () => {},
  sessions: [],
  setSessions: () => {},
  session: null,
  setSession: () => {},
  isLoading: false,
  setIsLoading: () => {},
  generatingNodeId: null,
  setGeneratingNodeId: () => {},
  clearSession: () => {},
};

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    RabbitHoleContext.Provider,
    { value: contextValue as never },
    children,
  );
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockGenerateQuickPreview.mockReset();
  mockGenerateQuickPreview.mockResolvedValue({
    data: "Preview text",
    error: null,
  });
  mockGetSessionById.mockReset();
  mockGetSessionById.mockResolvedValue({ data: null, error: null });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const { useRabbitHoles } = await import("@/lib/rabbit-holes/useRabbitHoles");

describe("useRabbitHoles exploreQuestion generate API", () => {
  test("calls fetch with POST, correct URL, and body containing nodeId and session", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: "job-1",
          sessionId: SESSION_ID,
          nodeId: NODE_ID,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useRabbitHoles(), { wrapper });

    await act(async () => {
      result.current.exploreQuestion("Test question");
    });

    expect(mockFetch.mock.calls.length).toBe(1);
    const [url, init] = (mockFetch.mock.calls as unknown as [string, RequestInit][])[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(/^\/api\/rabbitholes\/[^/]+\/generate$/.test(url)).toBe(true);
    expect(init?.headers != null).toBe(true);
    const headers = new Headers(init?.headers as HeadersInit);
    expect(headers.get("Content-Type")).toBe("application/json");
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.nodeId != null).toBe(true);
    expect(typeof body.nodeId).toBe("string");
    expect(body.session != null).toBe(true);
    expect(typeof body.session).toBe("string");
    const parsedSession = JSON.parse(body.session as string) as { sessionId: string };
    expect(parsedSession.sessionId != null).toBe(true);
  });

  test("on 202, updates session to include generatingNodeId", async () => {
    const returnedNodeId = "660e8400-e29b-41d4-a716-446655440002";
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: "job-1",
          sessionId: SESSION_ID,
          nodeId: returnedNodeId,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useRabbitHoles(), { wrapper });

    await act(async () => {
      result.current.exploreQuestion("Test question");
    });

    expect(result.current.session?.generatingNodeId).toBe(returnedNodeId);
    expect(result.current.generatingNodeId != null).toBe(true);
  });

  test("on 4xx, sets error and clears generating state", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useRabbitHoles(), { wrapper });

    await act(async () => {
      result.current.exploreQuestion("Test question");
    });

    expect(result.current.error).toBe("Unauthorized");
    expect(result.current.generatingNodeId).toBeNull();
    expect(result.current.preview).toBeNull();
  });

  test("on 5xx, sets error and clears generating state", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useRabbitHoles(), { wrapper });

    await act(async () => {
      result.current.exploreQuestion("Test question");
    });

    expect(result.current.error).toBe("Server error");
    expect(result.current.generatingNodeId).toBeNull();
    expect(result.current.preview).toBeNull();
  });
});
