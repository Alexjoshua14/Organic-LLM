import { z } from "zod";

/** Default Ergon origin (REST admin / workspace UI). */
export const DEFAULT_ERGON_BASE_URL = "https://ergon.coalescencelabs.app";

/** Default Ergon MCP endpoint for per-user OAuth (product path). */
export const DEFAULT_ERGON_MCP_URL = "https://ergon.coalescencelabs.app/mcp";

/**
 * Logical capability scopes Organic maps onto a connection for Mira / ticket tools.
 * OAuth itself uses openid/offline_access at AuthKit; these describe what Organic enables.
 */
export const ERGON_CONNECTION_SCOPES = ["read", "write", "agents"] as const;

export type ErgonConnectionScope = (typeof ERGON_CONNECTION_SCOPES)[number];

export const ErgonConnectionScopeSchema = z.enum(ERGON_CONNECTION_SCOPES);

export const ERGON_AUTH_MODES = ["oauth", "interim_pat", "env"] as const;
export type ErgonAuthMode = (typeof ERGON_AUTH_MODES)[number];

export const ErgonAuthModeSchema = z.enum(ERGON_AUTH_MODES);

export const ERGON_TRANSPORTS = ["mcp", "rest"] as const;
export type ErgonTransport = (typeof ERGON_TRANSPORTS)[number];

export const ErgonTransportSchema = z.enum(ERGON_TRANSPORTS);

/**
 * Server-side record. Access (+ optional refresh) tokens are stored only as ciphertext.
 * API responses never include them.
 */
export const ErgonConnectionRecordSchema = z.object({
  url: z.string().min(1).max(500),
  mcpUrl: z.string().min(1).max(500),
  tokenCiphertext: z.string().min(1),
  refreshTokenCiphertext: z.string().nullable().default(null),
  authMode: ErgonAuthModeSchema.default("oauth"),
  transport: ErgonTransportSchema.default("mcp"),
  scopes: z.array(ErgonConnectionScopeSchema).min(1).max(3),
  expiresAt: z.string().nullable().default(null),
  connectedAt: z.string().min(1),
  lastOkAt: z.string().nullable().default(null),
});

export type ErgonConnectionRecord = z.infer<typeof ErgonConnectionRecordSchema>;

/** Client-safe status — never includes tokens or ciphertext. */
export const ErgonConnectionPublicSchema = z.object({
  connected: z.boolean(),
  authMode: ErgonAuthModeSchema.nullable().default(null),
  transport: ErgonTransportSchema.nullable().default(null),
  source: z.enum(["user", "env"]).nullable(),
  url: z.string().nullable(),
  mcpUrl: z.string().nullable().default(null),
  scopes: z.array(ErgonConnectionScopeSchema).default([]),
  connectedAt: z.string().nullable(),
  lastOkAt: z.string().nullable(),
  expiresAt: z.string().nullable().default(null),
  hasToken: z.boolean(),
  /** True when this Organic deployment can start MCP OAuth (client id + redirect). */
  oauthReady: z.boolean().default(false),
});

export type ErgonConnectionPublic = z.infer<typeof ErgonConnectionPublicSchema>;

/** Legacy PUT body for interim PAT (not the Mira product path). */
export const ErgonConnectionPutSchema = z.object({
  url: z.string().min(1).max(500),
  token: z.string().min(1).max(2_000).optional(),
  scopes: z.array(ErgonConnectionScopeSchema).min(1).max(3),
});

export type ErgonConnectionPut = z.infer<typeof ErgonConnectionPutSchema>;

export function uniqueErgonScopes(
  scopes: readonly ErgonConnectionScope[]
): ErgonConnectionScope[] {
  return ERGON_CONNECTION_SCOPES.filter((scope) => scopes.includes(scope));
}

export function ergonScopesInclude(
  scopes: readonly string[],
  required: ErgonConnectionScope
): boolean {
  return scopes.includes(required);
}

/**
 * Normalize a workspace origin for REST admin / display:
 * HTTPS (or loopback HTTP), no credentials/query/hash, pathname must be `/`.
 */
export function parseErgonWorkspaceUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  try {
    const url = new URL(raw.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Normalize an Ergon MCP URL (default path `/mcp`).
 * HTTPS (or loopback HTTP); no credentials/query/hash.
 */
export function parseErgonMcpUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  try {
    const url = new URL(raw.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash) return null;

    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path !== "/mcp" && path !== "/") return null;

    url.pathname = path === "/" ? "/mcp" : path;
    url.search = "";
    url.hash = "";

    return url.href;
  } catch {
    return null;
  }
}

export function mcpUrlForWorkspace(workspaceUrl: string): string {
  const origin = parseErgonWorkspaceUrl(workspaceUrl) ?? DEFAULT_ERGON_BASE_URL;

  return parseErgonMcpUrl(`${origin}/mcp`) ?? DEFAULT_ERGON_MCP_URL;
}

export function toPublicErgonConnection(
  record: ErgonConnectionRecord | null,
  envFallback?: {
    url: string;
    mcpUrl?: string | null;
    scopes: readonly ErgonConnectionScope[];
    transport?: ErgonTransport;
  } | null,
  options?: { oauthReady?: boolean }
): ErgonConnectionPublic {
  const oauthReady = options?.oauthReady ?? false;

  if (record) {
    return {
      connected: true,
      authMode: record.authMode === "env" ? "oauth" : record.authMode,
      transport: record.transport,
      source: "user",
      url: record.url,
      mcpUrl: record.mcpUrl,
      scopes: uniqueErgonScopes(record.scopes),
      connectedAt: record.connectedAt,
      lastOkAt: record.lastOkAt,
      expiresAt: record.expiresAt,
      hasToken: Boolean(record.tokenCiphertext),
      oauthReady,
    };
  }

  if (envFallback) {
    return {
      connected: true,
      authMode: "env",
      transport: envFallback.transport ?? "rest",
      source: "env",
      url: envFallback.url,
      mcpUrl: envFallback.mcpUrl ?? null,
      scopes: uniqueErgonScopes([...envFallback.scopes]),
      connectedAt: null,
      lastOkAt: null,
      expiresAt: null,
      hasToken: true,
      oauthReady,
    };
  }

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

/** Worktable / orchestrator note for `connector:ergon` — never includes credentials. */
export function formatErgonConnectorForWorktable(
  status: ErgonConnectionPublic | null | undefined
): string {
  if (!status?.connected) {
    return [
      "User Ergon Connector — not connected",
      "Specialist Routing: Delegate Ergon planning to Mira (`agent-planner` / `subagent-planner`) after the user connects in Settings → Connectors.",
      "Ask the user to open Settings → Connectors and connect Ergon with MCP OAuth.",
    ].join("\n");
  }

  const lines = [
    `User Ergon Connector — ${status.mcpUrl ?? status.url ?? "connected"} (${
      status.authMode === "oauth" ? "MCP OAuth" : status.authMode ?? "connected"
    })`,
    "Specialist Routing: Mira (`agent-planner`) owns docs / briefs / agent runs (`tools.ergon` over MCP). Main chat gets write ticket tools when the connection includes write. There is no second Ergon hard-set agent.",
  ];

  if (status.scopes.length > 0) {
    lines.push(`Scopes: ${status.scopes.join(", ")}`);
  }
  if (status.source) lines.push(`Source: ${status.source}`);
  if (status.connectedAt) lines.push(`Connected at: ${status.connectedAt}`);
  lines.push(
    "Live Ergon tools use this user's server-side MCP OAuth session. Never ask them to paste a token into chat."
  );

  return lines.join("\n");
}
