import { describe, expect, test } from "bun:test";

import { probeErgonMcpConnection } from "@/lib/llm/ergon-mcp-client";

const mcpUrl = "https://ergon.example.com/mcp";
const token = "oauth_access_secret";

describe("Ergon MCP probe diagnostics", () => {
  test("preserves HTTP rejection details while redacting credentials before truncation", async () => {
    const result = await probeErgonMcpConnection({
      token,
      mcpUrl,
      fetch: async () =>
        new Response(
          `Invalid audience: ${token}; Bearer another_secret; eyJhbGciOiJIUzI1NiJ9.payload.signature\n${"x".repeat(600)}`,
          { status: 403 }
        ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failed probe");

    expect(result.diagnostic.stage).toBe("initialize");
    expect(result.diagnostic.httpStatus).toBe(403);
    expect(result.diagnostic.message).toContain("Invalid audience");
    expect(result.diagnostic.message).toContain("[REDACTED]");
    expect(result.diagnostic.message).not.toContain(token);
    expect(result.diagnostic.message).not.toContain("another_secret");
    expect(result.diagnostic.message).not.toContain("eyJhbGci");
    expect(result.diagnostic.message).not.toContain("\n");
    expect(result.diagnostic.message.length).toBeLessThanOrEqual(500);
  });

  test("distinguishes a network failure from an HTTP rejection", async () => {
    const result = await probeErgonMcpConnection({
      token,
      mcpUrl,
      fetch: async () => {
        throw new Error("Connection refused");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failed probe");

    expect(result.diagnostic.stage).toBe("initialize");
    expect(result.diagnostic.httpStatus).toBeNull();
    expect(result.diagnostic.message).toContain("Connection refused");
  });

  test("distinguishes tool rejection from successful MCP initialization", async () => {
    const result = await probeErgonMcpConnection({
      token,
      mcpUrl,
      fetch: async (_input, init) => {
        const message = JSON.parse(String(init?.body));

        if (message.id === undefined) return new Response(null, { status: 202 });

        return Response.json({
          jsonrpc: "2.0",
          id: message.id,
          result:
            message.method === "initialize"
              ? {
                  protocolVersion: "2025-06-18",
                  capabilities: { tools: {} },
                  serverInfo: { name: "ergon", version: "1.0.0" },
                }
              : { isError: true, content: [{ type: "text", text: "Permission denied" }] },
        });
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failed probe");

    expect(result.diagnostic).toEqual({
      stage: "list_projects",
      httpStatus: 200,
      message: "Permission denied",
    });
  });
});
