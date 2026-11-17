import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { asSchema } from "ai";

import { createErgonAgentTools } from "@/lib/llm/ergon-agent-tools";
import {
  ERGON_TEST_OWNER,
  ERGON_TEST_STRANGER,
  installConnectedErgon,
  recordingErgonCalls,
  uninstallConnectedErgon,
} from "../helpers/ergon-connected";

const TOKEN = "oauth_access_agent_test";
const options = { toolCallId: "test", messages: [] };

beforeEach(async () => {
  await installConnectedErgon({ token: TOKEN });
});
afterEach(uninstallConnectedErgon);

describe("Mira's Ergon tools", () => {
  test("need the user's own connection with the agents scope", async () => {
    expect(await createErgonAgentTools(ERGON_TEST_STRANGER)).toEqual({});

    await installConnectedErgon({ scopes: ["read", "write"] });
    expect(await createErgonAgentTools(ERGON_TEST_OWNER)).toEqual({});

    await installConnectedErgon({ token: TOKEN });
    expect(Object.keys(await createErgonAgentTools(ERGON_TEST_OWNER)).sort()).toEqual([
      "ergon_get_agent_run",
      "ergon_get_clause",
      "ergon_get_document",
      "ergon_get_issue_brief",
      "ergon_list_agent_runs",
      "ergon_list_documents",
      "ergon_list_hooks",
      "ergon_list_open_questions",
      "ergon_start_agent_run",
    ]);
  });

  test("read docs through Ergon with the user's token and bound their size", async () => {
    const { calls, callTool } = recordingErgonCalls(() => ({
      id: "doc_1",
      path: "organic-llm/aion/async-subagents.md",
      content: "x".repeat(20_000),
      clauses: [{ anchor: "ORCH-CTX-1" }],
    }));
    const tools = await createErgonAgentTools(ERGON_TEST_OWNER, { callTool });

    const doc = (await tools.ergon_get_document!.execute!(
      { id: "organic-llm/aion/async-subagents.md" },
      options
    )) as Record<string, unknown>;

    expect(calls[0]).toMatchObject({
      name: "get_document",
      token: TOKEN,
      mcpUrl: "https://ergon.example.com/mcp",
    });
    expect((doc.content as string).length).toBe(12_000);
    expect(doc.truncated).toContain("20000");
    expect(doc.clauses).toEqual([{ anchor: "ORCH-CTX-1" }]);

    await tools.ergon_get_agent_run!.execute!({ id: "run_1" }, options);
    expect(calls[1].input).toEqual({ id: "run_1", logChars: 4_000 });
  });

  test("start agent runs once, validating the budget and reporting Ergon's scope errors", async () => {
    const ok = recordingErgonCalls(() => ({ id: "run_9", status: "queued", branch: "coa-123-x" }));
    const tools = await createErgonAgentTools(ERGON_TEST_OWNER, { callTool: ok.callTool });

    expect(
      await tools.ergon_start_agent_run!.execute!(
        { issue: "COA-123", repo: "organic-llm" },
        options
      )
    ).toEqual({ id: "run_9", status: "queued", branch: "coa-123-x" });
    expect(
      await tools.ergon_start_agent_run!.execute!(
        { issue: "COA-123", repo: "organic-llm", budgetUsd: 500 },
        options
      )
    ).toMatchObject({ error: expect.stringContaining("budgetUsd") });
    expect(ok.calls).toHaveLength(1);

    const forbidden = recordingErgonCalls(() => ({
      error: 'Token "organic-mira" lacks the "agents" scope',
    }));
    const denied = await createErgonAgentTools(ERGON_TEST_OWNER, {
      callTool: forbidden.callTool,
    });

    expect(
      await denied.ergon_start_agent_run!.execute!({ issue: "COA-1", repo: "organic-llm" }, options)
    ).toEqual({ error: 'Token "organic-mira" lacks the "agents" scope' });

    const lost = await createErgonAgentTools(ERGON_TEST_OWNER, {
      callTool: async () => {
        throw new Error("timeout");
      },
    });

    expect(
      await lost.ergon_start_agent_run!.execute!({ issue: "COA-1", repo: "organic-llm" }, options)
    ).toMatchObject({ error: expect.stringContaining("List agent runs") });
  });

  test("schemas avoid unions so the assembled toolset stays inside provider limits", async () => {
    for (const definition of Object.values(await createErgonAgentTools(ERGON_TEST_OWNER))) {
      const schema = JSON.stringify(await asSchema(definition.inputSchema).jsonSchema);

      expect(schema).not.toContain("anyOf");
      expect(schema).not.toContain("oneOf");
    }
  });
});
