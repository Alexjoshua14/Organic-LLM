import { describe, expect, test } from "bun:test";
import { asSchema } from "ai";

import { chronosConfigForUser, createChronosTools } from "@/lib/llm/chronos-mcp-tools";

const env = {
  CHRONOS_MCP_URL: "http://localhost:3005/api/mcp",
  CHRONOS_MCP_TOKEN: "chronos-test-token",
  CHRONOS_OWNER_PROFILE_ID: "owner-profile",
};
const options = { toolCallId: "test", messages: [] };

type Rpc = { id?: number; method: string; params?: { name?: string; arguments?: unknown } };

/** A stateless Chronos MCP stand-in that records what Organic sends. */
function fakeChronos(answer: (name: string, args: unknown) => Record<string, unknown>) {
  const seen: Array<{ method: string; authorization: string | null; params?: Rpc["params"] }> = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);

    if (init?.method !== "POST") return new Response(null, { status: 405 });
    const msg = JSON.parse(String(init.body)) as Rpc;

    seen.push({
      method: msg.method,
      authorization: headers.get("authorization"),
      params: msg.params,
    });
    expect(String(input)).toBe(env.CHRONOS_MCP_URL);
    if (msg.id === undefined) return new Response(null, { status: 202 });

    const result =
      msg.method === "initialize"
        ? {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "chronos", version: "0.1.0" },
          }
        : answer(msg.params?.name ?? "", msg.params?.arguments);

    return Response.json({ jsonrpc: "2.0", id: msg.id, result });
  };

  return { fetch: fetch as typeof globalThis.fetch, seen };
}

describe("Chronos MCP tools", () => {
  test("deny every other profile and incomplete or unsafe configuration", () => {
    expect(createChronosTools("stranger", { env })).toEqual({});
    for (const key of Object.keys(env)) {
      expect(createChronosTools("owner-profile", { env: { ...env, [key]: "" } })).toEqual({});
    }
    for (const url of [
      "http://chronos.example.com/api/mcp",
      "https://user:pw@chronos.example.com/api/mcp",
      "https://chronos.example.com/api/mcp?token=x",
      "invalid",
    ]) {
      expect(chronosConfigForUser("owner-profile", { ...env, CHRONOS_MCP_URL: url })).toBeNull();
    }
    expect(
      chronosConfigForUser("owner-profile", {
        ...env,
        CHRONOS_MCP_URL: "https://chronos.example.com/api/mcp",
      })?.url
    ).toBe("https://chronos.example.com/api/mcp");
  });

  test("call Chronos git over MCP with the owner's bearer token and return its evidence", async () => {
    const run = {
      repo: "organic-llm",
      command: "git status --short --branch",
      head: "a".repeat(40),
      branch: "main",
      exitCode: 0,
      stdout: "## main\n",
      stderr: "",
      truncated: false,
      timedOut: false,
    };
    const chronos = fakeChronos(() => ({
      content: [{ type: "text", text: JSON.stringify(run) }],
      structuredContent: run,
      isError: false,
    }));
    const tools = createChronosTools("owner-profile", { env, fetch: chronos.fetch });

    const result = await tools.chronos_git!.execute!(
      { repo: "organic-llm", command: "status", args: ["--short", "--branch"] },
      options
    );

    expect(result).toEqual(run);
    const call = chronos.seen.find((m) => m.method === "tools/call");

    expect(call?.params).toEqual({
      name: "git",
      arguments: { repo: "organic-llm", command: "status", args: ["--short", "--branch"] },
    });
    expect(chronos.seen.every((m) => m.authorization === "Bearer chronos-test-token")).toBe(true);
    expect(chronos.seen[0]?.method).toBe("initialize");
  });

  test("surface refused commands and unreachable hosts as tool errors", async () => {
    const refused = fakeChronos(() => ({
      content: [{ type: "text", text: "Error: git push is not allowed." }],
      isError: true,
    }));
    const tools = createChronosTools("owner-profile", { env, fetch: refused.fetch });

    expect(
      await tools.chronos_git!.execute!({ repo: "organic-llm", command: "push" }, options)
    ).toEqual({ error: "Error: git push is not allowed." });

    const down = createChronosTools("owner-profile", {
      env,
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof globalThis.fetch,
    });

    expect(await down.chronos_list_repos!.execute!({}, options)).toMatchObject({
      error: expect.stringContaining("Chronos did not respond"),
    });
  });

  test("schemas avoid unions so the assembled toolset stays inside provider limits", async () => {
    const tools = createChronosTools("owner-profile", { env });

    for (const definition of Object.values(tools)) {
      const schema = JSON.stringify(await asSchema(definition.inputSchema).jsonSchema);

      expect(schema).not.toContain("anyOf");
      expect(schema).not.toContain("oneOf");
    }
  });
});
