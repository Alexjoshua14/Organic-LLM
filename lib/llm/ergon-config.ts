import "server-only";

import {
  loadErgonConnectionRecord,
  resolveErgonConnectionToken,
  resolveErgonRefreshToken,
  saveErgonConnectionRecord,
  type ErgonConnectionStoreOptions,
} from "@/lib/connectors/ergon-connection-store";
import { exchangeErgonOAuthToken, isErgonOAuthReady } from "@/lib/connectors/ergon-oauth";
import {
  ERGON_CONNECTION_SCOPES,
  ergonScopesInclude,
  mcpUrlForWorkspace,
  parseErgonMcpUrl,
  parseErgonWorkspaceUrl,
  type ErgonAuthMode,
  type ErgonConnectionRecord,
  type ErgonConnectionScope,
  type ErgonTransport,
} from "@/lib/schemas/ergon-connection";

export type ErgonConfig = {
  url: string;
  mcpUrl: string;
  token: string;
  scopes: readonly ErgonConnectionScope[];
  source: "user" | "env";
  authMode: ErgonAuthMode;
  transport: ErgonTransport;
};

export type ErgonEnv = Record<string, string | undefined>;

export type ErgonConfigPurpose = "tickets" | "agents";

export type ErgonConfigDeps = {
  env?: ErgonEnv;
  loadConnection?: (
    profileId: string
  ) => Promise<ErgonConnectionRecord | null>;
  resolveToken?: (
    profileId: string,
    record: ErgonConnectionRecord
  ) => Promise<string | null>;
  storeOptions?: ErgonConnectionStoreOptions;
  /** Injected for tests; defaults to AuthKit refresh via ergon-oauth. */
  refreshOAuth?: (refreshToken: string) => Promise<
    | {
        ok: true;
        accessToken: string;
        refreshToken: string | null;
        expiresAt: string | null;
      }
    | { ok: false }
  >;
};

function envOwnerId(env: ErgonEnv): string | null {
  const id = env.ERGON_OWNER_PROFILE_ID?.trim();

  return id || null;
}

function envBridgeConfig(
  sbUserId: string,
  purpose: ErgonConfigPurpose,
  env: ErgonEnv
): ErgonConfig | null {
  if (!sbUserId || sbUserId !== envOwnerId(env)) return null;

  const url = parseErgonWorkspaceUrl(env.ERGON_URL);

  if (!url) return null;

  const mcpUrl =
    parseErgonMcpUrl(env.ERGON_MCP_URL) ?? mcpUrlForWorkspace(url);

  if (purpose === "tickets") {
    const token = env.ERGON_TOKEN?.trim();

    if (!token) return null;

    return {
      url,
      mcpUrl,
      token,
      scopes: ["read", "write"],
      source: "env",
      authMode: "env",
      // Admin ticket fallback stays on REST `/api/rpc` (COA-286 / ERGON_TOKEN).
      transport: "rest",
    };
  }

  const token = env.ERGON_AGENT_TOKEN?.trim();

  if (!token) return null;

  return {
    url,
    mcpUrl,
    token,
    scopes: ["read", "agents"],
    source: "env",
    authMode: "env",
    transport: "rest",
  };
}

function tokenExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);

  if (!Number.isFinite(ms)) return false;

  // Refresh a minute early.
  return ms <= nowMs + 60_000;
}

async function resolveUserAccessToken(
  sbUserId: string,
  record: ErgonConnectionRecord,
  deps: ErgonConfigDeps
): Promise<{ token: string; record: ErgonConnectionRecord } | null> {
  const resolve =
    deps.resolveToken ??
    ((id: string, rec: ErgonConnectionRecord) => resolveErgonConnectionToken(id, rec));

  let token = await resolve(sbUserId, record);
  let current = record;

  if (
    record.authMode === "oauth" &&
    tokenExpired(record.expiresAt, Date.now())
  ) {
    const refresh = await resolveErgonRefreshToken(sbUserId, record);

    if (refresh) {
      const refresher =
        deps.refreshOAuth ??
        (async (refreshToken: string) => {
          const result = await exchangeErgonOAuthToken({
            grantType: "refresh_token",
            refreshToken,
          });

          if (!result.ok) return { ok: false as const };

          return {
            ok: true as const,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            expiresAt: result.tokens.expiresAt,
          };
        });

      const refreshed = await refresher(refresh);

      if (refreshed.ok) {
        current = await saveErgonConnectionRecord(
          sbUserId,
          {
            url: record.url,
            mcpUrl: record.mcpUrl,
            token: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? refresh,
            authMode: "oauth",
            transport: record.transport === "rest" ? "mcp" : record.transport,
            scopes: record.scopes,
            expiresAt: refreshed.expiresAt,
            lastOkAt: new Date().toISOString(),
          },
          deps.storeOptions
        );
        token = refreshed.accessToken;
      }
    }
  }

  if (!token) return null;

  return { token, record: current };
}

/**
 * Resolve Ergon credentials for a Supabase profile.
 *
 * Order: per-user Settings connection (MCP OAuth preferred) →
 * env owner REST bridge (`ERGON_OWNER_PROFILE_ID` + token for the purpose).
 */
export async function ergonConfigForUser(
  sbUserId: string,
  purpose: ErgonConfigPurpose,
  deps: ErgonConfigDeps = {}
): Promise<ErgonConfig | null> {
  if (!sbUserId.trim()) return null;

  const env = deps.env ?? process.env;
  const requiredScope: ErgonConnectionScope =
    purpose === "tickets" ? "write" : "agents";

  const load =
    deps.loadConnection ??
    ((id: string) => loadErgonConnectionRecord(id, deps.storeOptions));

  const record = await load(sbUserId);

  if (record) {
    const url = parseErgonWorkspaceUrl(record.url);
    const resolved = url ? await resolveUserAccessToken(sbUserId, record, deps) : null;

    if (url && resolved && ergonScopesInclude(record.scopes, requiredScope)) {
      const mcpUrl =
        parseErgonMcpUrl(resolved.record.mcpUrl) ?? mcpUrlForWorkspace(url);

      return {
        url,
        mcpUrl,
        token: resolved.token,
        scopes: resolved.record.scopes,
        source: "user",
        authMode: resolved.record.authMode === "env" ? "oauth" : resolved.record.authMode,
        transport: resolved.record.transport,
      };
    }
  }

  return envBridgeConfig(sbUserId, purpose, env);
}

/** Public status helper for Settings / API — never exposes a token. */
export async function ergonPublicStatusForUser(
  sbUserId: string,
  deps: ErgonConfigDeps = {}
): Promise<{
  connected: boolean;
  authMode: ErgonAuthMode | null;
  transport: ErgonTransport | null;
  source: "user" | "env" | null;
  url: string | null;
  mcpUrl: string | null;
  scopes: ErgonConnectionScope[];
  connectedAt: string | null;
  lastOkAt: string | null;
  expiresAt: string | null;
  hasToken: boolean;
  oauthReady: boolean;
}> {
  const env = deps.env ?? process.env;
  const oauthReady = isErgonOAuthReady(env);
  const load =
    deps.loadConnection ??
    ((id: string) => loadErgonConnectionRecord(id, deps.storeOptions));
  const record = sbUserId.trim() ? await load(sbUserId) : null;

  if (record) {
    const url = parseErgonWorkspaceUrl(record.url);

    return {
      connected: Boolean(url && record.tokenCiphertext),
      authMode: record.authMode,
      transport: record.transport,
      source: "user",
      url,
      mcpUrl: record.mcpUrl,
      scopes: [...record.scopes],
      connectedAt: record.connectedAt,
      lastOkAt: record.lastOkAt,
      expiresAt: record.expiresAt,
      hasToken: Boolean(record.tokenCiphertext),
      oauthReady,
    };
  }

  const tickets = envBridgeConfig(sbUserId, "tickets", env);
  const agents = envBridgeConfig(sbUserId, "agents", env);
  const bridge = tickets ?? agents;

  if (!bridge) {
    return {
      connected: false,
      authMode: null,
      transport: null,
      source: null,
      url: null,
      mcpUrl: null,
      scopes: [],
      connectedAt: null,
      lastOkAt: null,
      expiresAt: null,
      hasToken: false,
      oauthReady,
    };
  }

  const scopes = new Set<ErgonConnectionScope>();

  if (tickets) for (const s of tickets.scopes) scopes.add(s);
  if (agents) for (const s of agents.scopes) scopes.add(s);

  return {
    connected: true,
    authMode: "env",
    transport: bridge.transport,
    source: "env",
    url: bridge.url,
    mcpUrl: bridge.mcpUrl,
    scopes: ERGON_CONNECTION_SCOPES.filter((scope) => scopes.has(scope)),
    connectedAt: null,
    lastOkAt: null,
    expiresAt: null,
    hasToken: true,
    oauthReady,
  };
}
