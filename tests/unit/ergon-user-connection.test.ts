import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import {
  clearErgonConnectionMemoryStore,
  deleteErgonConnectionRecord,
  loadErgonConnectionRecord,
  resolveErgonConnectionToken,
  saveErgonConnectionRecord,
} from "@/lib/connectors/ergon-connection-store";
import { isErgonOAuthReady } from "@/lib/connectors/ergon-oauth";
import { ergonConfigForUser } from "@/lib/llm/ergon-config";
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

describe("per-user Ergon connection schema", () => {
  test("public status never carries a token field", () => {
    const publicStatus = toPublicErgonConnection({
      url: DEFAULT_ERGON_BASE_URL,
      mcpUrl: DEFAULT_ERGON_MCP_URL,
      tokenCiphertext: JSON.stringify({ encrypted: false, token: "erg_secret-token-value" }),
      refreshTokenCiphertext: null,
      authMode: "oauth",
      transport: "mcp",
      scopes: ["read", "write", "agents"],
      expiresAt: null,
      connectedAt: "2026-10-22T00:00:00.000Z",
      lastOkAt: null,
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

describe("Ergon OAuth store + ticket gating", () => {
  afterEach(() => {
    clearErgonConnectionMemoryStore();
  });

  test("persists ciphertext per Supabase user and resolves before env fallback", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "ergon-conn-"));

    try {
      await saveErgonConnectionRecord(
        "user-a",
        {
          token: "oauth_access_user-a",
          refreshToken: "oauth_refresh_user-a",
          url: "https://ergon.example.com",
          mcpUrl: "https://ergon.example.com/mcp",
          authMode: "oauth",
          transport: "mcp",
          scopes: ["read", "write", "agents"],
        },
        { rootDir }
      );

      const loaded = await loadErgonConnectionRecord("user-a", { rootDir });

      expect(loaded).not.toBeNull();
      expect(loaded?.authMode).toBe("oauth");
      expect(loaded?.transport).toBe("mcp");
      expect(JSON.stringify(toPublicErgonConnection(loaded))).not.toContain("oauth_access");
      expect(await resolveErgonConnectionToken("user-a", loaded!)).toBe("oauth_access_user-a");
      expect(await loadErgonConnectionRecord("user-b", { rootDir })).toBeNull();

      const config = await ergonConfigForUser("user-a", "tickets", {
        loadConnection: async () => loaded,
        resolveToken: async () => "oauth_access_user-a",
        env: {
          ERGON_URL: "https://admin.example.com",
          ERGON_TOKEN: "erg_admin",
          ERGON_OWNER_PROFILE_ID: "user-a",
        },
      });

      expect(config).toMatchObject({
        url: "https://ergon.example.com",
        mcpUrl: "https://ergon.example.com/mcp",
        token: "oauth_access_user-a",
        source: "user",
        authMode: "oauth",
        transport: "mcp",
      });

      const tools = await createErgonTicketTools("user-a", {
        loadConnection: async () => loaded,
        resolveToken: async () => "oauth_access_user-a",
        env: {
          ERGON_URL: "https://admin.example.com",
          ERGON_TOKEN: "erg_admin",
          ERGON_OWNER_PROFILE_ID: "nobody",
        },
      });

      expect(Object.keys(tools)).toContain("ergon_save_issue");
      expect(await createErgonTicketTools("stranger", { env: {} })).toEqual({});

      await deleteErgonConnectionRecord("user-a", { rootDir });
      expect(await loadErgonConnectionRecord("user-a", { rootDir })).toBeNull();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("env owner REST fallback still works when no per-user OAuth exists", async () => {
    const config = await ergonConfigForUser("owner", "tickets", {
      loadConnection: async () => null,
      env: {
        ERGON_URL: "https://ergon.example.com",
        ERGON_TOKEN: "erg_env",
        ERGON_OWNER_PROFILE_ID: "owner",
      },
    });

    expect(config).toMatchObject({
      url: "https://ergon.example.com",
      token: "erg_env",
      source: "env",
      authMode: "env",
      transport: "rest",
    });
    expect(
      await ergonConfigForUser("other", "tickets", {
        loadConnection: async () => null,
        env: {
          ERGON_URL: "https://ergon.example.com",
          ERGON_TOKEN: "erg_env",
          ERGON_OWNER_PROFILE_ID: "owner",
        },
      })
    ).toBeNull();
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
