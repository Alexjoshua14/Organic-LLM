import { setErgonConnectionRepoForTests } from "@/lib/connectors/ergon-connection-repo";
import { saveErgonConnectionRecord } from "@/lib/connectors/ergon-connection-store";
import type { callErgonTool } from "@/lib/llm/ergon-mcp-client";
import type { ErgonConnectionScope } from "@/lib/schemas/ergon-connection";
import { createMemoryErgonRepo } from "./ergon-memory-repo";

export const ERGON_TEST_OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const ERGON_TEST_STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const ERGON_TEST_URL = "https://ergon.example.com";

/**
 * Gives `owner` a real per-user Ergon connection in an in-memory database that the whole
 * store → config → tools stack reads through. There is no env or shared credential path.
 */
export async function installConnectedErgon(
  options: {
    owner?: string;
    token?: string;
    url?: string;
    scopes?: readonly ErgonConnectionScope[];
  } = {}
) {
  (process.env as Record<string, string | undefined>).ORGANIC_LLM_ROOT_SECRET ??=
    "test-root-secret";
  const repo = createMemoryErgonRepo();

  setErgonConnectionRepoForTests(repo);
  await saveErgonConnectionRecord(options.owner ?? ERGON_TEST_OWNER, {
    url: options.url ?? ERGON_TEST_URL,
    token: options.token ?? "oauth_access_test",
    refreshToken: "oauth_refresh_test",
    scopes: options.scopes ?? ["read", "write", "agents"],
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  });

  return repo;
}

export function uninstallConnectedErgon() {
  setErgonConnectionRepoForTests(null);
}

/** Replaces the MCP transport: records each call and answers from `handler`. */
export function recordingErgonCalls(
  handler: (name: string, input: unknown) => unknown = () => ({})
) {
  const calls: Array<{ name: string; input: unknown; token: string; mcpUrl: string }> = [];
  const callTool: typeof callErgonTool = async ({ config, name, input }) => {
    calls.push({ name, input, token: config.token, mcpUrl: config.mcpUrl });

    return handler(name, input);
  };

  return { calls, callTool };
}
