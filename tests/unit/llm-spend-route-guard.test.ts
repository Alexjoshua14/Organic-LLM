import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every API route that can spend model tokens must check the user's plan budget, so a spent
 * plan halts spend everywhere — including routes added later. A route that matches the spend
 * heuristic but never calls a model goes on the exemption list with its reason.
 */

const ROOT = join(import.meta.dir, "..", "..");
const API_DIR = join(ROOT, "app", "api");

/** Imports or calls that can lead to a model call. */
const SPENDS =
  /from "ai"|from "@ai-sdk\/|@\/lib\/llm\/|@\/lib\/memory\/|@\/lib\/profile-generation|rabbit-hole|@\/lib\/speak\/|openai|run-queued|tryDispatchThreadQueue|createAion|streamText|generateText|generateObject|experimental_decide/;

/** Any of these means the route checks the plan budget (directly or via a gate that does). */
const GATED =
  /requireLlmChatActor\((?!\{ planBudget: false \})|requirePlanBudget|getPlanBudgetForUser|requireTtsActor|checkSpeakRealtimeSessionStart|assertSpeakBudgetOrClose|createAion(Event)?Handler/;

const EXEMPT: Record<string, string> = {
  "app/api/ai/ideas/route.ts": "Model call is commented out; returns a static response.",
  "app/api/subagents/shells/route.ts": "Creates a shell thread; no model call.",
  "app/api/chat/[id]/stream/route.ts": "Resumes an existing stream; starts no new generation.",
  "app/api/chat/[id]/arcadia/subagents/route.ts": "Reads the subagent board; no model call.",
  "app/api/chat/context-budget/route.ts": "Estimates context size; no model call.",
  "app/api/chat/arcadia-starter/route.ts": "Saves a starter key; no model call.",
  "app/api/ai/speak/realtime/context/route.ts":
    "Formats ambient context for a live call; the call heartbeat ends spend.",
  "app/api/ai/speak/realtime/progress/route.ts":
    "Formats a progress item for a live call; no model call.",
  "app/api/ai/speak/realtime/milestone/route.ts":
    "Formats a milestone item for a live call; no model call.",
  "app/api/ai/speak/realtime/transcript/route.ts":
    "Persists the call's own turns; the call heartbeat ends spend.",
  "app/api/ai/speak/realtime/active/route.ts": "Reads session state; no model call.",
  "app/api/ai/speak/realtime/end/route.ts": "Ends a session and settles its usage; no model call.",
};

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) return routeFiles(path);

    return name === "route.ts" ? [relative(ROOT, path)] : [];
  });
}

describe("LLM spend route guard", () => {
  const routes = routeFiles(API_DIR);

  test("every route that can spend tokens checks the plan budget or is a reasoned exemption", () => {
    const ungated = routes.filter((route) => {
      const source = readFileSync(join(ROOT, route), "utf8");

      return SPENDS.test(source) && !GATED.test(source) && !EXEMPT[route];
    });

    expect(ungated).toEqual([]);
  });

  test("exemptions point at real routes and are not also gated", () => {
    for (const route of Object.keys(EXEMPT)) {
      expect(routes).toContain(route);
      expect(GATED.test(readFileSync(join(ROOT, route), "utf8"))).toBe(false);
    }
  });
});
