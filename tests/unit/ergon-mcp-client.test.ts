import { describe, expect, test } from "bun:test";

import { callErgonTool } from "@/lib/llm/ergon-mcp-client";

const TOKEN = "oauth_access_secret_value";
const config = { mcpUrl: "https://ergon.example.com/mcp", token: TOKEN };

describe("callErgonTool", () => {
  test("never echoes the user's token when the transport fails", async () => {
    const result = (await callErgonTool({
      config,
      name: "list_projects",
      input: {},
      fetch: (async () => {
        throw new Error(`socket closed; Authorization: Bearer ${TOKEN}; token=${TOKEN}`);
      }) as typeof fetch,
    })) as { error: string };

    expect(result.error).toContain("Ergon MCP did not respond");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  test("sends the user's token as a bearer to the MCP endpoint", async () => {
    const seen: Array<{ url: string; auth: string | null }> = [];

    await callErgonTool({
      config,
      name: "list_projects",
      input: {},
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({
          url: String(input),
          auth: new Headers(init?.headers).get("authorization"),
        });
        throw new Error("stop after first request");
      }) as typeof fetch,
    });

    expect(seen[0]).toMatchObject({ url: config.mcpUrl, auth: `Bearer ${TOKEN}` });
  });
});
