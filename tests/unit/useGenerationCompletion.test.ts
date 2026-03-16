import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { ensureDom } from "../helpers/render";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NODE_ID = "660e8400-e29b-41d4-a716-446655440001";

const completedSession: RabbitHoleSession = {
  sessionId: SESSION_ID,
  rootQuestion: "Q",
  path: [{ nodeId: NODE_ID, label: "L", parentNodeId: null }],
  nodesById: {
    [NODE_ID]: {
      id: NODE_ID,
      rawPrompt: "P",
      userQuestion: "Q",
      keyTakeaways: ["K1", "K2", "K3"],
      articleHtml: "<p>Done</p>",
      sources: [],
      branchSuggestions: [],
      createdAt: new Date().toISOString(),
    },
  },
  activeNodeId: NODE_ID,
  edges: [],
  generatingNodeId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockGetSessionById = mock(async () => ({
  data: completedSession,
  error: null,
}));

mock.module("@/data/supabase/rabbitholes", () => ({
  ...(globalThis as unknown as { __realRabbitholes: typeof import("@/data/supabase/rabbitholes") })
    .__realRabbitholes,
  getSessionById: mockGetSessionById,
}));

const { useGenerationCompletion } = await import(
  "@/lib/rabbit-holes/useGenerationCompletion"
);

ensureDom();

beforeEach(() => {
  mockGetSessionById.mockReset();
  mockGetSessionById.mockResolvedValue({
    data: completedSession,
    error: null,
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useGenerationCompletion", () => {
  test("polls getSessionById at interval and calls onSessionUpdated when session has generatingNodeId null", async () => {
    const onSessionUpdated = mock((session: RabbitHoleSession) => {
      expect(session.generatingNodeId).toBeNull();
    });

    const { unmount: unmountHook } = renderHook(
      () =>
        useGenerationCompletion(SESSION_ID, NODE_ID, onSessionUpdated),
    );

    expect(mockGetSessionById.mock.calls.length).toBe(0);

    jest.advanceTimersByTime(2500);

    await Promise.resolve();
    await Promise.resolve();

    expect(mockGetSessionById.mock.calls.length).toBe(1);
    expect(
      (mockGetSessionById.mock.calls as unknown as Array<[string]>)[0]?.[0],
    ).toBe(SESSION_ID);
    expect(onSessionUpdated.mock.calls.length).toBe(1);
    expect(onSessionUpdated.mock.calls[0]?.[0]).toBe(completedSession);

    unmountHook();
  });

  test("does not poll when sessionId is null", () => {
    const onSessionUpdated = mock(() => {});

    renderHook(() =>
      useGenerationCompletion(null, NODE_ID, onSessionUpdated),
    );

    jest.advanceTimersByTime(10000);

    expect(mockGetSessionById.mock.calls.length).toBe(0);
    expect(onSessionUpdated.mock.calls.length).toBe(0);
  });

  test("does not poll when generatingNodeId is null", () => {
    const onSessionUpdated = mock(() => {});

    renderHook(() =>
      useGenerationCompletion(SESSION_ID, null, onSessionUpdated),
    );

    jest.advanceTimersByTime(10000);

    expect(mockGetSessionById.mock.calls.length).toBe(0);
    expect(onSessionUpdated.mock.calls.length).toBe(0);
  });

  test("stops polling and does not call onSessionUpdated after unmount", async () => {
    const onSessionUpdated = mock(() => {});

    const { unmount: unmountHook } = renderHook(
      () =>
        useGenerationCompletion(SESSION_ID, NODE_ID, onSessionUpdated),
    );

    unmountHook();

    jest.advanceTimersByTime(2500);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockGetSessionById.mock.calls.length).toBe(0);
    expect(onSessionUpdated.mock.calls.length).toBe(0);
  });
});
