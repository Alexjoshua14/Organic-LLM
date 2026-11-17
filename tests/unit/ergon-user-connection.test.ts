import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { isErgonOAuthReady } from "@/lib/connectors/ergon-oauth";
import { ergonConfigForUser, ergonPublicStatusForUser } from "@/lib/llm/ergon-config";
import { createErgonTicketTools } from "@/lib/llm/ergon-ticket-tools";
import { HARD_SET_SUBAGENTS, getHardSetSubagent } from "@/lib/llm/subagents/hard-set/registry";
import { resolveShorthandRef } from "@/lib/llm/subagents/worktable/shorthand";
import {
  DEFAULT_ERGON_BASE_URL,
  DEFAULT_ERGON_MCP_URL,
  ErgonConnectionPublicSchema,
  formatErgonConnectorForWorktable,
  mcpUrlForWorkspace,
  parseErgonMcpUrl,
  parseErgonWorkspaceUrl,
  toPublicErgonConnection,
} from "@/lib/schemas/ergon-connection";
import { normalizeUserConnectorsProfile } from "@/lib/schemas/user-connectors";
import {
  ERGON_TEST_OWNER,
  ERGON_TEST_STRANGER,
  installConnectedErgon,
  uninstallConnectedErgon,
} from "../helpers/ergon-connected";

describe("per-user Ergon connection schema", () => {
  test("public status never carries a token field", () => {
    const publicStatus = toPublicErgonConnection({
      url: DEFAULT_ERGON_BASE_URL,
      mcpUrl: DEFAULT_ERGON_MCP_URL,
      tokenCiphertext: "enc:v1:k1:aXY=:dGFn:erg_secret-token-value",
      refreshTokenCiphertext: null,
      authMode: "oauth",
      transport: "mcp",
      scopes: ["read", "write", "agents"],
      expiresAt: null,
      connectedAt: "2026-10-22T00:00:00.000Z",
      lastOkAt: null,
      version: 1,
    });

    expect(ErgonConnectionPublicSchema.parse(publicStatus).connected).toBe(true);
    expect(publicStatus.authMode).toBe("oauth");
    expect(publicStatus.transport).toBe("mcp");
    expect(JSON.stringify(publicStatus)).not.toContain("erg_secret");
    expect(formatErgonConnectorForWorktable(publicStatus)).toContain("MCP OAuth");
    expect(formatErgonConnectorForWorktable(publicStatus)).toContain("Mira");
    expect(formatErgonConnectorForWorktable(publicStatus)).not.toContain("subagent-ergon");
    expect(formatErgonConnectorForWorktable(publicStatus)).not.toContain("erg_secret");
  });

  test("rejects non-origin workspace URLs and normalizes MCP URLs", () => {
    expect(parseErgonWorkspaceUrl("https://ergon.example.com/mcp")).toBeNull();
    expect(parseErgonWorkspaceUrl("https://user:pass@ergon.example.com")).toBeNull();
    expect(parseErgonWorkspaceUrl(DEFAULT_ERGON_BASE_URL)).toBe(DEFAULT_ERGON_BASE_URL);
    expect(parseErgonMcpUrl(DEFAULT_ERGON_MCP_URL)).toBe(DEFAULT_ERGON_MCP_URL);
    expect(parseErgonMcpUrl("https://ergon.example.com/")).toBe("https://ergon.example.com/mcp");
    expect(mcpUrlForWorkspace(DEFAULT_ERGON_BASE_URL)).toBe(DEFAULT_ERGON_MCP_URL);
  });

  test("oauth ready requires client id + redirect", () => {
    expect(isErgonOAuthReady({})).toBe(false);
    expect(
      isErgonOAuthReady({
        ERGON_OAUTH_CLIENT_ID: "client_test",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      })
    ).toBe(true);
  });
});

describe("per-user Ergon connection gating", () => {
  beforeEach(async () => {
    await installConnectedErgon({ token: "oauth_access_user-a" });
  });
  afterEach(uninstallConnectedErgon);

  test("only the connected profile resolves credentials, and only its own", async () => {
    const config = await ergonConfigForUser(ERGON_TEST_OWNER, "tickets");

    expect(config).toMatchObject({
      url: "https://ergon.example.com",
      mcpUrl: "https://ergon.example.com/mcp",
      token: "oauth_access_user-a",
    });
    expect(Object.keys(config ?? {}).sort()).toEqual(["mcpUrl", "scopes", "token", "url"]);

    const tools = await createErgonTicketTools(ERGON_TEST_OWNER);

    expect(Object.keys(tools)).toContain("ergon_save_issue");
    expect(await ergonConfigForUser(ERGON_TEST_STRANGER, "tickets")).toBeNull();
    expect(await createErgonTicketTools(ERGON_TEST_STRANGER)).toEqual({});
  });

  test("no deployment-wide environment credential grants access", async () => {
    const saved = { ...process.env };

    try {
      Object.assign(process.env, {
        ERGON_URL: "https://ergon.example.com",
        ERGON_TOKEN: "erg_env",
        ERGON_AGENT_TOKEN: "erg_env_agent",
        ERGON_OWNER_PROFILE_ID: ERGON_TEST_STRANGER,
      });

      expect(await ergonConfigForUser(ERGON_TEST_STRANGER, "tickets")).toBeNull();
      expect(await ergonConfigForUser(ERGON_TEST_STRANGER, "agents")).toBeNull();
      expect(await createErgonTicketTools(ERGON_TEST_STRANGER)).toEqual({});
    } finally {
      for (const key of ["ERGON_TOKEN", "ERGON_AGENT_TOKEN", "ERGON_OWNER_PROFILE_ID"]) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
      if (saved.ERGON_URL === undefined) delete process.env.ERGON_URL;
      else process.env.ERGON_URL = saved.ERGON_URL;
    }
  });

  test("public status carries no tokens and reports the stored connection", async () => {
    const status = await ergonPublicStatusForUser(ERGON_TEST_OWNER);

    expect(status).toMatchObject({ connected: true, source: "user", authMode: "oauth", transport: "mcp" });
    expect(JSON.stringify(status)).not.toContain("oauth_access");
    expect(ErgonConnectionPublicSchema.parse(status).hasToken).toBe(true);
    expect((await ergonPublicStatusForUser(ERGON_TEST_STRANGER)).connected).toBe(false);
  });

  test("a cached public status from before env/PAT removal is dropped, not fatal", () => {
    const profile = normalizeUserConnectorsProfile({
      ergonConnection: { connected: true, authMode: "env", source: "env" } as never,
    });

    expect(profile.ergonConnection).toBeNull();
  });
});

describe("Mira remains the only Ergon hard-set agent", () => {
  test("no subagent-ergon roster entry; Mira keeps tools.ergon", () => {
    expect(getHardSetSubagent("subagent-ergon")).toBeNull();
    expect(getHardSetSubagent("agent-planner")?.tools.ergon).toBe(true);
    expect(HARD_SET_SUBAGENTS.some((agent) => agent.id === "subagent-ergon")).toBe(false);
  });

  test("connector:ergon shorthand points at Mira without leaking secrets", () => {
    const connected = normalizeUserConnectorsProfile({
      ergonConnection: {
        connected: true,
        authMode: "oauth",
        transport: "mcp",
        source: "user",
        url: DEFAULT_ERGON_BASE_URL,
        mcpUrl: DEFAULT_ERGON_MCP_URL,
        scopes: ["read", "write", "agents"],
        connectedAt: "2026-10-22T00:00:00.000Z",
        lastOkAt: null,
        expiresAt: null,
        hasToken: true,
        oauthReady: true,
      },
    });
    const resolved = resolveShorthandRef("connector:ergon", { userConnectors: connected });

    expect(resolved.ok).toBe(true);
    if (resolved.ok && resolved.kind === "item") {
      expect(resolved.item.text).toContain("MCP OAuth");
      expect(resolved.item.text).not.toContain("erg_");
      expect(resolved.item.agentId).toBe("agent-planner");
    }

    const missing = resolveShorthandRef("connector:ergon", {
      userConnectors: normalizeUserConnectorsProfile({}),
    });

    expect(missing.ok).toBe(true);
    if (missing.ok && missing.kind === "item") {
      expect(missing.item.text).toContain("not connected");
      expect(missing.item.text).toContain("MCP OAuth");
      expect(missing.item.agentId).toBe("agent-planner");
    }
  });
});
