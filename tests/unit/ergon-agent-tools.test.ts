import { describe, expect, test } from "bun:test";
import { asSchema } from "ai";

import { createErgonAgentTools } from "@/lib/llm/ergon-agent-tools";

const env = {
  ERGON_URL: "https://ergon.example.com",
  ERGON_TOKEN: "erg_chat-read-write",
  ERGON_AGENT_TOKEN: "erg_agent-read-agents",
  ERGON_OWNER_PROFILE_ID: "owner-profile",
};
const options = { toolCallId: "test", messages: [] };

function recordingFetch(body: (name: string) => unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });

    return Response.json(body(url.split("/").pop() ?? ""), { status });
  };

  return { calls, fetch };
}

describe("Mira's Ergon tools", () => {
  test("need the owner profile and the agent token, never the chat's write token", () => {
    expect(createErgonAgentTools("stranger", { env })).toEqual({});
    expect(
      createErgonAgentTools("owner-profile", { env: { ...env, ERGON_AGENT_TOKEN: "" } })
    ).toEqual({});
    expect(Object.keys(createErgonAgentTools("owner-profile", { env })).sort()).toEqual([
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

  test("read docs through Ergon's REST registry with the agent token and bound their size", async () => {
    const { calls, fetch } = recordingFetch(() => ({
      id: "doc_1",
      path: "organic-llm/aion/async-subagents.md",
      content: "x".repeat(20_000),
      clauses: [{ anchor: "ORCH-CTX-1" }],
    }));
    const tools = createErgonAgentTools("owner-profile", { env, fetch });

    const doc = (await tools.ergon_get_document!.execute!(
      { id: "organic-llm/aion/async-subagents.md" },
      options
    )) as Record<string, unknown>;

    expect(calls[0]!.url).toBe("https://ergon.example.com/api/rpc/get_document");
    expect(calls[0]!.init.headers).toMatchObject({ authorization: "Bearer erg_agent-read-agents" });
    expect(calls[0]!.init.redirect).toBe("error");
    expect((doc.content as string).length).toBe(12_000);
    expect(doc.truncated).toContain("20000");
    expect(doc.clauses).toEqual([{ anchor: "ORCH-CTX-1" }]);

    await tools.ergon_get_agent_run!.execute!({ id: "run_1" }, options);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ id: "run_1", logChars: 4_000 });
  });

  test("start agent runs once, validating the budget and reporting Ergon's scope errors", async () => {
    const ok = recordingFetch(() => ({ id: "run_9", status: "queued", branch: "coa-123-x" }));
    const tools = createErgonAgentTools("owner-profile", { env, fetch: ok.fetch });

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

    const forbidden = recordingFetch(
      () => ({ error: "forbidden", message: 'Token "organic-mira" lacks the "agents" scope' }),
      403
    );
    const denied = createErgonAgentTools("owner-profile", { env, fetch: forbidden.fetch });

    expect(
      await denied.ergon_start_agent_run!.execute!({ issue: "COA-1", repo: "organic-llm" }, options)
    ).toEqual({ error: 'Ergon returned HTTP 403: Token "organic-mira" lacks the "agents" scope' });

    const lost = createErgonAgentTools("owner-profile", {
      env,
      fetch: async () => {
        throw new Error("timeout");
      },
    });

    expect(
      await lost.ergon_start_agent_run!.execute!({ issue: "COA-1", repo: "organic-llm" }, options)
    ).toMatchObject({ error: expect.stringContaining("List agent runs") });
  });

  test("schemas avoid unions so the assembled toolset stays inside provider limits", async () => {
    for (const definition of Object.values(createErgonAgentTools("owner-profile", { env }))) {
      const schema = JSON.stringify(await asSchema(definition.inputSchema).jsonSchema);

      expect(schema).not.toContain("anyOf");
      expect(schema).not.toContain("oneOf");
    }
  });
});
