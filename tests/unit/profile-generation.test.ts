import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import * as ai from "ai";
import { NoObjectGeneratedError } from "ai";
import * as budgetHooks from "@/lib/plans/llm-budget-hooks";
import * as memoryOperations from "@/lib/memory/operations";
import * as metrics from "@/lib/llm/metrics";
import * as profiles from "@/data/supabase/profiles";
import { mockModulePreservingReal } from "../helpers/module-mock";

import {
  clampText,
  generateProfileFromMemory,
  normalizePlan,
  PROFILE_MODEL_SCHEMAS,
  toProfileSection,
} from "@/lib/profile-generation";

const { asSchema } = ai;

type FakeCall = {
  prompt: string;
  maxOutputTokens?: number;
  providerOptions?: { anthropic?: { thinking?: { type?: string } } };
};
let failSectionIds = new Set<string>();
let truncateOnce = new Set<string>();
let planOverride: Record<string, unknown> | null = null;
let calls: FakeCall[] = [];

function callKind(prompt: string) {
  if (prompt.includes("Plan the ideal ProfileTree")) return "ProfileSectionPlan";
  if (prompt.includes("Review every generated section")) return "ProfileSectionBatchReview";
  if (prompt.includes("Section-scoped memory evidence")) return "ProfileSection";

  return "ProfileTreeReview";
}

const usage = { inputTokens: 100, outputTokens: 100 };
const memories = [1, 2, 3, 4, 5].map((n) => ({ id: `m${n}`, memory: `Fact ${n}`, score: 0.9 }));

function plan() {
  return {
    headlineDirection: "A ceramicist who teaches and builds",
    roles: ["Ceramicist"],
    signatureDirection: null,
    sections: ["about", "work", "teaching", "interests"].map((id, index) => ({
      id,
      title: id[0]!.toUpperCase() + id.slice(1),
      purpose: `What ${id} covers`,
      memoryQueries: [`${id} facts`],
      desiredShape: "body" as const,
      priority: 10 - index,
    })),
  };
}

const fakeGenerateText = mock(async (args: FakeCall) => {
  calls.push(args);
  switch (callKind(args.prompt)) {
    case "ProfileSectionPlan":
      return { output: planOverride ?? plan(), usage };
    case "ProfileSection": {
      const id = /"id":"([^"]+)"/.exec(args.prompt)![1]!;

      if (failSectionIds.has(id)) throw new Error("model returned an invalid object");
      if (truncateOnce.has(id)) {
        truncateOnce.delete(id);
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          text: `{"id":"${id}","title":"Title","body":"Wants a`,
          finishReason: "length",
          response: { id: "resp", timestamp: new Date(), modelId: "anthropic/claude-sonnet-5.5" },
          usage: {
            inputTokens: 100,
            outputTokens: 1200,
            totalTokens: 1300,
            inputTokenDetails: {
              noCacheTokens: 100,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokenDetails: { textTokens: 300, reasoningTokens: 900 },
          },
        });
      }

      return {
        output: {
          // The model is free to rename the id; the pipeline must keep the plan's.
          id: `${id}-renamed`,
          title: `Title ${id}`,
          body: `Body for ${id}`,
          items: [],
          children: [],
        },
        usage,
      };
    }
    case "ProfileSectionBatchReview": {
      const ids = [...args.prompt.matchAll(/"id":"([^"]+)","title":"Title/g)].map((m) => m[1]!);

      return {
        output: {
          overallScore: 1.4,
          sections: ids.map((sectionId) => ({
            sectionId,
            score: 1.2,
            decision: "accept",
            issues: [],
            rewriteInstructions: null,
          })),
        },
        usage,
      };
    }
    default:
      return {
        output: {
          score: 0.9,
          decision: "accept",
          weakSectionIds: [],
          issues: [],
          rewriteInstructions: null,
        },
        usage,
      };
  }
});

const saved: Array<{
  status: string;
  tree: { headline: string; sections: Array<{ id: string }> };
}> = [];

const restores: Array<() => void> = [];

beforeAll(() => {
  restores.push(
    mockModulePreservingReal("ai", ai, { generateText: fakeGenerateText }),
    mockModulePreservingReal("@/lib/plans/llm-budget-hooks", budgetHooks, {
      createAuthenticatedLlmBudgetHooks: async () => ({}),
    }),
    mockModulePreservingReal("@/lib/memory/operations", memoryOperations, {
      searchMemoriesForUser: async () => ({ data: { results: memories }, error: null }),
    }),
    mockModulePreservingReal("@/lib/llm/metrics", metrics, { recordLlmCall: () => {} }),
    mockModulePreservingReal("@/data/supabase/profiles", profiles, {
      createProfileTreeRevisionForCurrentUser: async (input: (typeof saved)[number]) => {
        saved.push(input);

        return { data: { revisionId: "rev_1" }, error: null };
      },
    })
  );
});

afterAll(() => {
  for (const restore of restores) restore();
});

const run = () =>
  generateProfileFromMemory({ userId: "owner", displayName: "Jordan", email: "j@example.com" });

describe("profile generation", () => {
  test("writes every planned section and keeps the plan's section ids", async () => {
    failSectionIds = new Set();
    truncateOnce = new Set();
    planOverride = null;
    calls = [];
    saved.length = 0;
    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.revisionStatus).toBe("active");
    expect(result.data.tree.sections.map((section) => section.id)).toEqual([
      "about",
      "work",
      "teaching",
      "interests",
    ]);
    expect(result.data.reviewScore).toBe(0.9);
    expect(saved[0]?.status).toBe("active");
    expect(calls.map((call) => callKind(call.prompt))).toEqual([
      "ProfileSectionPlan",
      "ProfileSection",
      "ProfileSection",
      "ProfileSection",
      "ProfileSection",
      "ProfileSectionBatchReview",
      "ProfileTreeReview",
    ]);
    const sectionCall = calls.find((call) => callKind(call.prompt) === "ProfileSection");
    const planCall = calls.find((call) => callKind(call.prompt) === "ProfileSectionPlan");

    expect(sectionCall?.providerOptions?.anthropic?.thinking?.type).toBe("between_tools");
    expect(planCall?.providerOptions?.anthropic).toBeUndefined();
  });

  test("retries a section once when the model stops mid-JSON at the output limit", async () => {
    failSectionIds = new Set();
    truncateOnce = new Set(["work"]);
    planOverride = null;
    calls = [];
    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tree.sections.map((section) => section.id)).toContain("work");
    const workCalls = calls.filter(
      (call) => callKind(call.prompt) === "ProfileSection" && call.prompt.includes('"id":"work"')
    );

    expect(workCalls).toHaveLength(2);
    expect(workCalls[1]?.prompt).toContain("cut off before the JSON finished");
    expect(workCalls[1]?.maxOutputTokens).toBe(2400);
  });

  test("a section that cannot be written is dropped with a warning instead of failing the run", async () => {
    failSectionIds = new Set(["interests"]);
    truncateOnce = new Set();
    planOverride = null;
    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tree.sections.map((section) => section.id)).toEqual([
      "about",
      "work",
      "teaching",
    ]);
    expect(result.data.warnings).toEqual(["Dropped Interests: Could not be written"]);
  });

  test("fails only when no section could be written", async () => {
    failSectionIds = new Set(["about", "work", "teaching", "interests"]);
    truncateOnce = new Set();
    const result = await run();

    expect(result).toEqual({ ok: false, status: 500, error: "Failed to generate profile tree" });
  });

  test("clamps an over-long headline and out-of-range scores rather than rejecting the plan", async () => {
    failSectionIds = new Set();
    truncateOnce = new Set();
    planOverride = {
      ...plan(),
      headlineDirection: "word ".repeat(40).trim(),
      roles: Array.from({ length: 9 }, (_, index) => `Role ${index}`),
      signatureDirection: "signature ".repeat(30).trim(),
    };
    const result = await run();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tree.headline.length).toBeLessThanOrEqual(120);
    expect(result.data.tree.headline.endsWith("…")).toBe(true);
    expect(result.data.tree.roles).toHaveLength(6);
    expect(result.data.tree.signature!.length).toBeLessThanOrEqual(160);
  });
});

describe("model-facing schemas", () => {
  // Strict structured output (OpenAI) rejects a schema unless every property is required.
  // `.optional()` and `.default()` break that, and unit tests with a fake model cannot see it.
  function unrequiredProperties(node: unknown, path = "$"): string[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node))
      return node.flatMap((child, i) => unrequiredProperties(child, `${path}[${i}]`));
    const schema = node as Record<string, unknown>;
    const found: string[] = [];

    if (schema.properties && typeof schema.properties === "object") {
      const required = new Set(Array.isArray(schema.required) ? schema.required : []);

      for (const key of Object.keys(schema.properties)) {
        if (!required.has(key)) found.push(`${path}.${key}`);
      }
    }
    for (const [key, child] of Object.entries(schema)) {
      found.push(...unrequiredProperties(child, `${path}.${key}`));
    }

    return found;
  }

  test("every property is required", async () => {
    for (const [name, schema] of Object.entries(PROFILE_MODEL_SCHEMAS)) {
      const json = await asSchema(schema).jsonSchema;

      expect({ name, optional: unrequiredProperties(json) }).toEqual({ name, optional: [] });
    }
  });
});

describe("normalizers", () => {
  test("clampText cuts at a word boundary and marks the cut", async () => {
    expect(clampText("  short  ", 20)).toBe("short");
    expect(clampText("alpha beta gamma delta epsilon", 20)).toBe("alpha beta gamma…");
    expect(clampText("a".repeat(50), 10)).toBe(`${"a".repeat(9)}…`);
  });

  test("normalizePlan makes ids unique and bounds priority, queries and section count", async () => {
    const item = (id: string, priority: number, memoryQueries: string[]) => ({
      id,
      title: "T",
      purpose: "P",
      memoryQueries,
      desiredShape: "body" as const,
      priority,
    });
    const normalized = normalizePlan({
      headlineDirection: "H",
      roles: [],
      signatureDirection: "",
      sections: [
        item("About Me!", 42, []),
        item("about-me", 0, ["a", "b", "c", "d", "e"]),
        ...Array.from({ length: 20 }, (_, i) => item(`s${i}`, 5, ["q"])),
      ],
    });

    expect(normalized.sections.length).toBeLessThanOrEqual(16);
    expect(new Set(normalized.sections.map((section) => section.id)).size).toBe(
      normalized.sections.length
    );
    expect(normalized.sections[0]).toMatchObject({ id: "about-me-", priority: 10 });
    expect(normalized.sections[0]!.memoryQueries).toEqual(["T"]);
    expect(normalized.sections[1]!.memoryQueries).toHaveLength(3);
    expect(normalized.sections[1]!.priority).toBe(1);
    expect(normalized.signatureDirection).toBeNull();
  });

  test("toProfileSection keeps long subsection lists and clamps item text to the stored limits", async () => {
    const plan = {
      id: "interests",
      title: "Interests",
      purpose: "p",
      memoryQueries: ["q"],
      desiredShape: "children" as const,
      priority: 5,
    };
    const part = (id: string) => ({
      id,
      title: id,
      body: null,
      items: Array.from({ length: 15 }, () => "item ".repeat(40).trim()),
    });
    const section = toProfileSection(
      {
        ...part("model-chose-this"),
        children: ["a", "b", "c", "d", "e"].map(part),
      },
      plan
    );

    expect(section.id).toBe("interests");
    expect(section.children).toHaveLength(5);
    expect(section.items).toHaveLength(12);
    expect(section.items!.every((entry) => entry.length <= 120)).toBe(true);
    expect(section.body).toBeUndefined();
  });
});
