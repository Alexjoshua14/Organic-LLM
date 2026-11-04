/** Remote GitHub MCP endpoint. Arcadia does not register these tools; the probe is for the spike comparison. */
export const GITHUB_REMOTE_MCP_URL = "https://api.githubcopilot.com/mcp/";

export function parseMcpMessages(body: string): unknown[] {
  const trimmed = body.trim();

  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;

    return Array.isArray(parsed) ? parsed : [parsed];
  }

  const messages: unknown[] = [];

  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();

    if (!payload || payload === "[DONE]") continue;
    messages.push(JSON.parse(payload) as unknown);
  }

  return messages;
}

export function toolNamesFromMcpMessages(messages: unknown[]): string[] {
  const names: string[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const result = (message as { result?: { tools?: unknown } }).result;
    const tools = result?.tools;

    if (!Array.isArray(tools)) continue;

    for (const tool of tools) {
      if (
        tool &&
        typeof tool === "object" &&
        typeof (tool as { name?: unknown }).name === "string"
      ) {
        names.push((tool as { name: string }).name);
      }
    }
  }

  return names;
}

type FetchLike = typeof fetch;

function sessionIdFrom(response: Response): string | null {
  return response.headers.get("mcp-session-id") ?? response.headers.get("Mcp-Session-Id");
}

/**
 * Initialize the hosted GitHub MCP server and return its tool names.
 * Failures stay structured so a missing token or a protocol change does not throw into chat.
 */
export async function listGithubMcpTools(options: {
  token: string;
  fetchImpl?: FetchLike;
  url?: string;
}): Promise<{ ok: true; tools: string[] } | { ok: false; reason: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.url ?? GITHUB_REMOTE_MCP_URL;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  const post = async (body: unknown, session: string | null) => {
    const requestHeaders = { ...headers };

    if (session) requestHeaders["mcp-session-id"] = session;

    return fetchImpl(url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  };

  try {
    const initialized = await post(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "organic-llm-arcadia-spike", version: "0.0.0" },
        },
      },
      null
    );
    const session = sessionIdFrom(initialized);

    await initialized.text();

    if (!initialized.ok) {
      return { ok: false, reason: `MCP initialize returned ${initialized.status}` };
    }

    await post({ jsonrpc: "2.0", method: "notifications/initialized" }, session);

    const listed = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, session);
    const listBody = await listed.text();

    if (!listed.ok) {
      return { ok: false, reason: `MCP tools/list returned ${listed.status}` };
    }

    const tools = toolNamesFromMcpMessages(parseMcpMessages(listBody));

    if (tools.length === 0) {
      return { ok: false, reason: "MCP tools/list returned no tool names" };
    }

    return { ok: true, tools };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP probe failed";

    return { ok: false, reason: message.slice(0, 300) };
  }
}
