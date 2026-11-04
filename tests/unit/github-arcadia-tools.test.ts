import { describe, expect, test } from "bun:test";

import {
  listGithubMcpTools,
  parseMcpMessages,
  toolNamesFromMcpMessages,
} from "@/lib/github/mcp-probe";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { createGithubReadTools } from "@/lib/llm/github-tools";

describe("GitHub MCP probe", () => {
  test("parses SSE tool lists", () => {
    const body = [
      "event: message",
      'data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"get_file_contents"},{"name":"list_commits"},{"name":"list_pull_requests"}]}}',
      "",
    ].join("\n");
    const names = toolNamesFromMcpMessages(parseMcpMessages(body));

    expect(names).toEqual(["get_file_contents", "list_commits", "list_pull_requests"]);
  });

  test("lists tools from initialize plus tools/list", async () => {
    const calls: string[] = [];
    const result = await listGithubMcpTools({
      token: "test-token",
      url: "https://mcp.example.test/",
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { method: string };

        calls.push(body.method);
        if (body.method === "initialize") {
          return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } }), {
            status: 200,
            headers: { "mcp-session-id": "session-1", "content-type": "application/json" },
          });
        }
        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: { tools: [{ name: "get_file_contents" }, { name: "pull_request_read" }] },
          }),
          { status: 200 }
        );
      },
    });

    expect(calls).toEqual(["initialize", "notifications/initialized", "tools/list"]);
    expect(result).toEqual({ ok: true, tools: ["get_file_contents", "pull_request_read"] });
  });
});

describe("Arcadia GitHub tools", () => {
  test("registers the four read tools only for the arcadia experience", async () => {
    const arcadia = await compileChatTools({
      useSearch: false,
      useMemory: false,
      experience: "arcadia",
      sbUserId: "user-1",
    });
    const topic = await compileChatTools({
      useSearch: false,
      useMemory: false,
      experience: "topic_explore",
      sbUserId: "user-1",
    });

    expect(Object.keys(arcadia.tools)).toEqual(
      expect.arrayContaining([
        "github_repo_overview",
        "github_recent_commits",
        "github_pull_requests",
        "github_read_file",
      ])
    );
    expect(arcadia.toolInstructions).toContain("github_read_file");
    expect(topic.tools.github_read_file).toBeUndefined();
  });

  test("returns not_configured from the tool when the allowlist is missing", async () => {
    const tools = createGithubReadTools({
      sbUserId: "user-1",
      deps: {
        loadSettings: () => ({
          enabled: false,
          code: "not_configured",
          error: "GitHub read is not configured.",
        }),
      },
    });
    const result = await tools.github_read_file.execute!(
      { owner: "acme", repo: "widgets", path: "README.md", fidelity: "auto" },
      { toolCallId: "tc-github", messages: [] }
    );

    expect(result).toMatchObject({ ok: false, code: "not_configured" });
  });
});
