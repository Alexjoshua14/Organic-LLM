import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import {
  parsePlannerJson,
  planMemoryQueries,
  queriesFromPlan,
  secondPassQuery,
  type PlanMemoryQueriesOpts,
} from "@/lib/memory/query-planner";

function msg(role: "user" | "assistant", text: string, id: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

const transcript = [
  msg("user", "We are shipping Organic LLM next.", "u1"),
  msg("assistant", "Noted.", "a1"),
];

function mockGen(text: string): PlanMemoryQueriesOpts["generateTextImpl"] {
  return (async () => ({ text })) as PlanMemoryQueriesOpts["generateTextImpl"];
}

describe("parsePlannerJson", () => {
  test("parses raw JSON slots", () => {
    const parsed = parsePlannerJson(
      '{"entity":"Organic LLM","topic":"roadmap","rationale":"flagship"}'
    );

    expect(parsed).toEqual({
      entity: "Organic LLM",
      topic: "roadmap",
      preference: undefined,
      rationale: "flagship",
    });
  });

  test("parses fenced JSON", () => {
    const parsed = parsePlannerJson('```json\n{"topic":"status"}\n```');

    expect(parsed?.topic).toBe("status");
    expect(parsed?.entity).toBeUndefined();
  });

  test("empty slots and invalid JSON fail open at parse", () => {
    expect(parsePlannerJson("{}")).toBeNull();
    expect(parsePlannerJson("not json")).toBeNull();
    expect(parsePlannerJson('{"entity":""}')).toBeNull();
  });
});

describe("queriesFromPlan", () => {
  test("emits filled slots in entity / topic / preference order and de-dupes", () => {
    expect(
      queriesFromPlan(
        { entity: "Organic LLM", topic: "roadmap", preference: "Organic LLM" },
        "how's my flagship"
      )
    ).toEqual(["Organic LLM", "roadmap"]);
  });

  test("falls back to the raw query when no slots are filled", () => {
    expect(queriesFromPlan({}, "how's my flagship")).toEqual(["how's my flagship"]);
  });
});

describe("secondPassQuery", () => {
  test("runs when the resolved entity is not already in the user sentence", () => {
    expect(secondPassQuery({ entity: "Organic LLM", topic: "roadmap" }, "how's my flagship")).toBe(
      "Organic LLM roadmap"
    );
  });

  test("skips when the entity is already in the user sentence", () => {
    expect(secondPassQuery({ entity: "Organic LLM", topic: "status" }, "Organic LLM status")).toBeNull();
  });
});

describe("planMemoryQueries", () => {
  test("empty query returns no searches", async () => {
    const result = await planMemoryQueries("   ", transcript);

    expect(result.usedPlan).toBe(false);
    expect(result.queries).toEqual([]);
  });

  test("invalid planner output fails open to the raw query", async () => {
    const result = await planMemoryQueries("how's my flagship", transcript, {
      generateTextImpl: mockGen("not json"),
    });

    expect(result.usedPlan).toBe(false);
    expect(result.queries).toEqual(["how's my flagship"]);
  });

  test("timeout fails open to the raw query", async () => {
    const result = await planMemoryQueries("how's my flagship", transcript, {
      timeoutMs: 20,
      generateTextImpl: () =>
        new Promise(() => {
          /* never resolves */
        }),
    });

    expect(result.usedPlan).toBe(false);
    expect(result.queries).toEqual(["how's my flagship"]);
  });

  test("typed slots become search strings", async () => {
    const result = await planMemoryQueries("how's my flagship", transcript, {
      generateTextImpl: mockGen('{"entity":"Organic LLM","topic":"roadmap"}'),
    });

    expect(result.usedPlan).toBe(true);
    expect(result.queries).toEqual(["Organic LLM", "roadmap"]);
  });
});
