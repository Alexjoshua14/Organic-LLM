import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { HARD_SET_SUBAGENTS } from "@/lib/llm/subagents/hard-set/registry";
import { prepareWorkerTools } from "@/lib/llm/subagents/worker/prepare-input";

const OWNER = "synthetic-owner";
const CONNECTED_ENV = {
  CHRONOS_MCP_URL: "http://localhost:3005/api/mcp",
  CHRONOS_MCP_TOKEN: "test-only",
  CHRONOS_OWNER_PROFILE_ID: OWNER,
  ERGON_URL: "https://ergon.example.com",
  ERGON_TOKEN: "test-only",
  ERGON_AGENT_TOKEN: "test-only",
  ERGON_OWNER_PROFILE_ID: OWNER,
};
const saved: Record<string, string | undefined> = {};

// compileChatTools reads connection settings from process.env, as it does in production.
beforeAll(() => {
  for (const [key, value] of Object.entries(CONNECTED_ENV)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
});
afterAll(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

// Anthropic's union budget is request-wide (see chat-tool-schema-budget.test.ts).
function unionCount(schema: unknown): number {
  if (!schema || typeof schema !== "object") return 0;
  if (Array.isArray(schema)) return schema.reduce((sum, child) => sum + unionCount(child), 0);
  const node = schema as Record<string, unknown>;
  const union = Array.isArray(node.type) || Array.isArray(node.anyOf) || Array.isArray(node.oneOf);

  return (
    Number(union) + Object.values(node).reduce<number>((sum, child) => sum + unionCount(child), 0)
  );
}

const prepare = (agent: (typeof HARD_SET_SUBAGENTS)[number]) =>
  prepareWorkerTools({
    chatId: "synthetic-thread",
    sbUserId: OWNER,
    model: "anthropic/claude-sonnet-4.6",
    system: "Synthetic",
    messages: [],
    initialMessageCount: 1,
    toolPolicy: agent.tools,
  });

describe("connected-app tools in hard-set worker runs", () => {
  test("only the subagents whose policy forces them get Chronos or Ergon tools", async () => {
    for (const agent of HARD_SET_SUBAGENTS) {
      const names = Object.keys((await prepare(agent)).tools);

      expect(names.some((name) => name.startsWith("chronos_"))).toBe(agent.tools.chronos === true);
      expect(names.includes("ergon_start_agent_run")).toBe(agent.tools.ergon === true);
      // Mira (`tools.ergon`) stays agents-only; write ticket tools stay on main chat.
      expect(names.includes("ergon_save_issue")).toBe(false);
    }
  });

  test("Reed and Mira assembled worker toolsets stay under the union limit", async () => {
    for (const id of ["subagent-coder", "subagent-planner"]) {
      const agent = HARD_SET_SUBAGENTS.find((candidate) => candidate.id === id)!;
      const sent = JSON.parse((await prepare(agent)).toolSchemaText) as Array<{ schema: unknown }>;

      expect(unionCount(sent.map((tool) => tool.schema))).toBeLessThanOrEqual(16);
    }
  });
});
