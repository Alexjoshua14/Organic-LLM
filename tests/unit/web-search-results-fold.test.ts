import { describe, expect, test } from "bun:test";

import {
  collectWebSearchSnapshotsFromParts,
  foldWebSearchResults,
  isClosedWebSearchResult,
  type WebSearchInvocationSnapshot,
} from "@/lib/chat/web-search-results-fold";
import {
  appendWebSearchContext,
  tryParseWebSearchToolOutput,
} from "@/lib/chat/web-search-tool-output";

function successBody(title: string, url: string) {
  return {
    data: {
      results: [{ id: url, title, url, highlights: [`Excerpt for ${title}`] }],
    },
  };
}

function completedSnap(
  overrides: Partial<WebSearchInvocationSnapshot> &
    Pick<WebSearchInvocationSnapshot, "toolCallId" | "partIndex" | "query" | "body">
): WebSearchInvocationSnapshot {
  return {
    status: "completed",
    ...overrides,
  };
}

function inFlightSnap(
  overrides: Partial<WebSearchInvocationSnapshot> &
    Pick<WebSearchInvocationSnapshot, "toolCallId" | "partIndex" | "query">
): WebSearchInvocationSnapshot {
  return {
    status: "in-flight",
    ...overrides,
  };
}

describe("foldWebSearchResults", () => {
  test("two completed searches render as one component", () => {
    const snapshots: WebSearchInvocationSnapshot[] = [
      completedSnap({
        toolCallId: "ws-1",
        partIndex: 0,
        query: "organic llm memory",
        body: successBody("Memory docs", "https://example.com/memory"),
      }),
      completedSnap({
        toolCallId: "ws-2",
        partIndex: 1,
        query: "exa search api",
        body: successBody("Exa API", "https://exa.ai/docs"),
      }),
    ];

    const plan = foldWebSearchResults(snapshots);

    expect(plan.completedCount).toBe(2);
    expect(plan.anchorToolCallId).toBe("ws-1");
    expect([...plan.closedToolCallIds]).toEqual(["ws-2"]);
    expect(isClosedWebSearchResult(plan, "ws-2")).toBe(true);
    expect(isClosedWebSearchResult(plan, "ws-1")).toBe(false);
    expect(plan.combined).toEqual({
      status: "success",
      queries: ["organic llm memory", "exa search api"],
      rows: [
        expect.objectContaining({
          id: "ws-1:https://example.com/memory",
          title: "Memory docs",
          url: "https://example.com/memory",
        }),
        expect.objectContaining({
          id: "ws-2:https://exa.ai/docs",
          title: "Exa API",
          url: "https://exa.ai/docs",
        }),
      ],
    });
  });

  test("an active search stays separate from the completed fold", () => {
    const snapshots: WebSearchInvocationSnapshot[] = [
      completedSnap({
        toolCallId: "ws-done",
        partIndex: 0,
        query: "first query",
        body: successBody("First", "https://example.com/1"),
      }),
      inFlightSnap({
        toolCallId: "ws-active",
        partIndex: 1,
        query: "second query still running",
      }),
    ];

    const plan = foldWebSearchResults(snapshots);

    expect(plan.completedCount).toBe(1);
    expect(plan.anchorToolCallId).toBe("ws-done");
    expect(plan.closedToolCallIds.size).toBe(0);
    expect(plan.combined?.status).toBe("success");
    if (plan.combined?.status === "success") {
      expect(plan.combined.rows).toHaveLength(1);
      expect(plan.combined.queries).toEqual(["first query"]);
    }
    // Active invocation is not closed and is not the anchor.
    expect(isClosedWebSearchResult(plan, "ws-active")).toBe(false);
    expect(plan.anchorToolCallId).not.toBe("ws-active");
  });

  test("completing a second search appends onto the existing completed state", () => {
    const firstBody = successBody("First", "https://example.com/1");
    const secondBody = successBody("Second", "https://example.com/2");

    // After the first search completes: one completed card owns the results.
    const afterFirst = foldWebSearchResults([
      completedSnap({
        toolCallId: "ws-1",
        partIndex: 0,
        query: "first query",
        body: firstBody,
      }),
      inFlightSnap({
        toolCallId: "ws-2",
        partIndex: 1,
        query: "second query",
      }),
    ]);

    expect(afterFirst.anchorToolCallId).toBe("ws-1");
    expect(afterFirst.closedToolCallIds.size).toBe(0);
    expect(afterFirst.combined?.status).toBe("success");
    if (afterFirst.combined?.status === "success") {
      expect(afterFirst.combined.rows).toHaveLength(1);
      expect(afterFirst.combined.queries).toEqual(["first query"]);
    }

    // When the second search completes, close it and append onto the same completed shape.
    const afterSecond = foldWebSearchResults([
      completedSnap({
        toolCallId: "ws-1",
        partIndex: 0,
        query: "first query",
        body: firstBody,
      }),
      completedSnap({
        toolCallId: "ws-2",
        partIndex: 1,
        query: "second query",
        body: secondBody,
      }),
    ]);

    expect(afterSecond.anchorToolCallId).toBe("ws-1");
    expect([...afterSecond.closedToolCallIds]).toEqual(["ws-2"]);
    expect(afterSecond.combined?.status).toBe("success");
    if (afterSecond.combined?.status === "success" && afterFirst.combined?.status === "success") {
      expect(afterSecond.combined.queries).toEqual(["first query", "second query"]);
      expect(afterSecond.combined.rows).toHaveLength(2);
      expect(afterSecond.combined.rows[0]).toEqual(afterFirst.combined.rows[0]);
      expect(afterSecond.combined.rows[1]).toEqual(
        expect.objectContaining({
          title: "Second",
          url: "https://example.com/2",
        })
      );
    }

    // Same append helper used by the fold — not a new completed-state kind.
    const secondParsed = tryParseWebSearchToolOutput(secondBody);
    expect(secondParsed?.status).toBe("success");
    if (secondParsed?.status !== "success") return;

    const manuallyAppended = appendWebSearchContext(afterFirst.combined, {
      query: "second query",
      parsed: {
        status: "success",
        rows: secondParsed.rows.map((row) => ({ ...row, id: `ws-2:${row.id}` })),
      },
    });

    expect(manuallyAppended).toEqual(afterSecond.combined);
  });

  test("zero completed searches leaves no results component", () => {
    const plan = foldWebSearchResults([
      inFlightSnap({ toolCallId: "ws-a", partIndex: 0, query: "running" }),
    ]);

    expect(plan.anchorToolCallId).toBeNull();
    expect(plan.combined).toBeNull();
    expect(plan.completedCount).toBe(0);
    expect(plan.closedToolCallIds.size).toBe(0);
  });
});

describe("collectWebSearchSnapshotsFromParts", () => {
  test("collects modern tool parts within one response", () => {
    const parts = [
      {
        type: "tool-web_search",
        toolCallId: "ws-1",
        toolName: "web_search",
        state: "output-available",
        input: { query: "alpha" },
        output: successBody("A", "https://a.example"),
      },
      {
        type: "tool-web_search",
        toolCallId: "ws-2",
        toolName: "web_search",
        state: "input-available",
        input: { query: "beta" },
      },
      {
        type: "text",
        text: "still writing",
      },
    ];

    const snaps = collectWebSearchSnapshotsFromParts(parts);

    expect(snaps).toEqual([
      {
        toolCallId: "ws-1",
        partIndex: 0,
        status: "completed",
        query: "alpha",
        body: successBody("A", "https://a.example"),
      },
      {
        toolCallId: "ws-2",
        partIndex: 1,
        status: "in-flight",
        query: "beta",
      },
    ]);

    const plan = foldWebSearchResults(snaps);

    expect(plan.anchorToolCallId).toBe("ws-1");
    expect(plan.closedToolCallIds.size).toBe(0);
    expect(isClosedWebSearchResult(plan, "ws-2")).toBe(false);
  });
});
