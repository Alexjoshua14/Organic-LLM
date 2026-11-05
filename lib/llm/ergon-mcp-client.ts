import "server-only";

import type { ErgonConfig } from "@/lib/llm/ergon-config";

import { createMCPClient } from "@ai-sdk/mcp";

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
        args.input && typeof args.input === "object" ? (args.input as Record<string, unknown>) : {},
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
 * Probe whether a user's OAuth access token can initialize Ergon MCP.
 * Does not return secrets.
 */
export async function probeErgonMcpConnection(args: {
  token: string;
  mcpUrl: string;
  fetch?: Fetch;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      status?: number;
      diagnostic: {
        stage: "initialize" | "list_projects";
        httpStatus: number | null;
        message: string;
      };
    }
> {
  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;
  let stage: "initialize" | "list_projects" = "initialize";
  let httpStatus: number | null = null;
  const diagnostic = (message: string) => ({
    stage,
    httpStatus,
    // Transport errors can include response bodies. Redact before truncating or logging.
    message: message
      .split(args.token)
      .join("[REDACTED]")
      .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
      .replace(/[\r\n\t]/g, " ")
      .slice(0, 500),
  });

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
        fetch: (async (input, init) => {
          const response = await (args.fetch ?? globalThis.fetch)(input, init);

          httpStatus = response.status;

          return response;
        }) as Fetch,
      },
    });

    // list_projects is a cheap authenticated call shared with the REST probe.
    stage = "list_projects";
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
        diagnostic: diagnostic(text || "Ergon MCP rejected this credential."),
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ergon MCP probe failed.";

    return {
      ok: false,
      error:
        message.includes("401") || /unauthor/i.test(message)
          ? "Ergon MCP rejected this credential. Reconnect Ergon in Settings."
          : `Ergon MCP unreachable: ${message.slice(0, 200)}`,
      status: /401|403/.test(message) ? 401 : 502,
      diagnostic: diagnostic(message),
    };
  } finally {
    await client?.close().catch(() => {});
  }
}

/**
 * Call one Ergon tool as the connected user. MCP over the user's own OAuth token is the only
 * transport: there is no REST or shared-credential fallback.
 */
export async function callErgonTool(args: {
  config: Pick<ErgonConfig, "mcpUrl" | "token">;
  name: string;
  input: unknown;
  fetch?: Fetch;
}): Promise<unknown> {
  try {
    return await callErgonMcpTool(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ergon MCP call failed.";

    // Transport errors can echo response bodies; redact the bearer before it reaches the model.
    return {
      error: `Ergon MCP did not respond: ${message
        .split(args.config.token)
        .join("[REDACTED]")
        .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
        .slice(0, 200)}`,
    };
  }
}
