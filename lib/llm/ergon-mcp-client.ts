import "server-only";

import { createMCPClient } from "@ai-sdk/mcp";

import type { ErgonConfig } from "@/lib/llm/ergon-config";

type Fetch = typeof globalThis.fetch;

const ERGON_MCP_TIMEOUT_MS = 15_000;

/**
 * Call one Ergon tool over MCP Streamable HTTP (Chronos pattern via `@ai-sdk/mcp`).
 * Opens a short-lived session per call. Prefer this transport for OAuth connections.
 */
export async function callErgonMcpTool(args: {
  config: Pick<ErgonConfig, "mcpUrl" | "token">;
  name: string;
  input: unknown;
  fetch?: Fetch;
}): Promise<unknown> {
  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;

  try {
    client = await createMCPClient({
      clientName: "organic-llm",
      protocolVersionDiscovery: false,
      initializationOptions: { timeout: ERGON_MCP_TIMEOUT_MS },
      transport: {
        type: "http",
        url: args.config.mcpUrl,
        headers: { authorization: `Bearer ${args.config.token}` },
        redirect: "error",
        ...(args.fetch ? { fetch: args.fetch } : {}),
      },
    });

    const result = await client.callTool({
      name: args.name,
      arguments:
        args.input && typeof args.input === "object"
          ? (args.input as Record<string, unknown>)
          : {},
      options: { timeout: ERGON_MCP_TIMEOUT_MS },
    });

    const text = (Array.isArray(result.content) ? result.content : [])
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n");

    if (result.isError) {
      return { error: text || `Ergon MCP tool ${args.name} failed.` };
    }

    if (result.structuredContent && typeof result.structuredContent === "object") {
      return result.structuredContent;
    }

    if (text) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return { output: text };
      }
    }

    return result.structuredContent ?? {};
  } finally {
    await client?.close().catch(() => {});
  }
}

/**
 * Probe whether a bearer token can initialize Ergon MCP (OAuth or PAT).
 * Does not return secrets.
 */
export async function probeErgonMcpConnection(args: {
  token: string;
  mcpUrl: string;
  fetch?: Fetch;
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;

  try {
    client = await createMCPClient({
      clientName: "organic-llm",
      protocolVersionDiscovery: false,
      initializationOptions: { timeout: ERGON_MCP_TIMEOUT_MS },
      transport: {
        type: "http",
        url: args.mcpUrl,
        headers: { authorization: `Bearer ${args.token}` },
        redirect: "error",
        ...(args.fetch ? { fetch: args.fetch } : {}),
      },
    });

    // list_projects is a cheap authenticated call shared with the REST probe.
    const result = await client.callTool({
      name: "list_projects",
      arguments: {},
      options: { timeout: ERGON_MCP_TIMEOUT_MS },
    });

    if (result.isError) {
      const text = (Array.isArray(result.content) ? result.content : [])
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n");

      return {
        ok: false,
        error: text || "Ergon MCP rejected this credential.",
        status: 401,
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ergon MCP probe failed.";

    return {
      ok: false,
      error: message.includes("401") || /unauthor/i.test(message)
        ? "Ergon MCP rejected this credential. Prefer Connect with Ergon (OAuth)."
        : `Ergon MCP unreachable: ${message.slice(0, 200)}`,
      status: /401|403/.test(message) ? 401 : 502,
    };
  } finally {
    await client?.close().catch(() => {});
  }
}

/** REST `/api/rpc/<tool>` fallback when MCP is unavailable for this credential. */
export async function callErgonRestRpc(args: {
  config: Pick<ErgonConfig, "url" | "token">;
  name: string;
  input: unknown;
  fetch?: Fetch;
}): Promise<unknown> {
  const response = await (args.fetch ?? fetch)(`${args.config.url}/api/rpc/${args.name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.config.token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(args.input ?? {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const message =
      body && typeof body.message === "string" ? `: ${body.message.slice(0, 300)}` : "";

    return { error: `Ergon returned HTTP ${response.status}${message}` };
  }

  return body && typeof body === "object" ? body : { result: body };
}

/**
 * Prefer MCP; when the connection is marked `rest` (interim PAT that MCP rejected,
 * or admin env bridge), use `/api/rpc`.
 */
export async function callErgonTool(args: {
  config: ErgonConfig;
  name: string;
  input: unknown;
  fetch?: Fetch;
}): Promise<unknown> {
  if (args.config.transport === "rest") {
    return callErgonRestRpc(args);
  }

  try {
    return await callErgonMcpTool(args);
  } catch (error) {
    // OAuth sessions must not silently fall back to REST with a mismatched credential model.
    if (args.config.authMode === "oauth") {
      const message = error instanceof Error ? error.message : "Ergon MCP call failed.";

      return { error: `Ergon MCP did not respond: ${message.slice(0, 200)}` };
    }

    // Interim PAT / env: fall back once to REST if MCP is unavailable for this token.
    return callErgonRestRpc(args);
  }
}
