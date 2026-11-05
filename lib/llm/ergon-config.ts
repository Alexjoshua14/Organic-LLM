import "server-only";

import {
  claimErgonRefreshLock,
  loadErgonConnectionRecord,
  releaseErgonRefreshLock,
  resolveErgonConnectionToken,
  resolveErgonRefreshToken,
  rotateErgonConnectionTokens,
  ErgonConnectionStoreError,
  type ErgonConnectionStoreOptions,
} from "@/lib/connectors/ergon-connection-store";
import {
  exchangeErgonOAuthToken,
  isErgonOAuthReady,
  type ErgonOAuthEnv,
} from "@/lib/connectors/ergon-oauth";
import { createLogger } from "@/lib/logger";
import {
  ergonScopesInclude,
  mcpUrlForWorkspace,
  parseErgonMcpUrl,
  parseErgonWorkspaceUrl,
  toPublicErgonConnection,
  type ErgonConnectionPublic,
  type ErgonConnectionRecord,
  type ErgonConnectionScope,
} from "@/lib/schemas/ergon-connection";

const logger = createLogger("lib/llm/ergon-config.ts");

/** Everything Organic needs to call Ergon as one specific user. Built per request, never stored. */
export type ErgonConfig = {
  url: string;
  mcpUrl: string;
  token: string;
  scopes: readonly ErgonConnectionScope[];
};

export type ErgonConfigPurpose = "tickets" | "agents";

type RefreshResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      expiresAt: string | null;
    }
  | { ok: false };

export type ErgonConfigDeps = {
  /** Only used to decide whether this deployment can start OAuth (public status). */
  env?: ErgonOAuthEnv;
  loadConnection?: (profileId: string) => Promise<ErgonConnectionRecord | null>;
  /**
   * A read of this user's connection started earlier in the request (see
   * `startErgonConnectionSnapshot`). Used ONLY for cheap "are the tools available" and status
   * decisions at turn start, so one request makes one read instead of one per consumer. Tool
   * calls always read fresh, because they may refresh a token and need the latest row.
   */
  connectionSnapshot?: Promise<ErgonConnectionRecord | null>;
  resolveToken?: (profileId: string, record: ErgonConnectionRecord) => Promise<string | null>;
  storeOptions?: ErgonConnectionStoreOptions;
  /** Injected for tests; defaults to AuthKit refresh via ergon-oauth. */
  refreshOAuth?: (refreshToken: string) => Promise<RefreshResult>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** Refresh a minute before expiry. */
const REFRESH_EARLY_MS = 60_000;
/** How long a request that lost the refresh lock waits for the winner before giving up. */
const REFRESH_WAIT_MS = 10_000;
const REFRESH_POLL_MS = 500;

function needsRefresh(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);

  if (!Number.isFinite(ms)) return false;

  return ms <= nowMs + REFRESH_EARLY_MS;
}

function reallyExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);

  if (!Number.isFinite(ms)) return false;

  return ms <= nowMs;
}

/** Only the short store code is ever logged; store errors never carry token material. */
function errorCode(error: unknown): string | null {
  return error instanceof ErgonConnectionStoreError ? (error.code ?? error.operation) : null;
}

type Resolved = { token: string; record: ErgonConnectionRecord };

async function defaultRefresh(refreshToken: string): Promise<RefreshResult> {
  const result = await exchangeErgonOAuthToken({ grantType: "refresh_token", refreshToken });

  if (!result.ok) return { ok: false };

  return {
    ok: true,
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    expiresAt: result.tokens.expiresAt,
  };
}

/**
 * Refresh while holding the cross-instance lock. The row is reloaded after the claim: another
 * instance may have refreshed (and rotated the refresh token) between our read and our claim,
 * and reusing a rotated refresh token can revoke the whole grant.
 */
async function refreshHoldingLock(
  profileId: string,
  deps: ErgonConfigDeps,
  load: (id: string) => Promise<ErgonConnectionRecord | null>,
  resolve: (id: string, rec: ErgonConnectionRecord) => Promise<string | null>
): Promise<Resolved | null> {
  const now = deps.now ?? Date.now;
  const store = deps.storeOptions;
  let rotated = false;

  try {
    const fresh = await load(profileId);

    if (!fresh) return null;

    if (!needsRefresh(fresh.expiresAt, now())) {
      const token = await resolve(profileId, fresh);

      return token ? { token, record: fresh } : null;
    }

    const stillUsable = async (): Promise<Resolved | null> => {
      if (reallyExpired(fresh.expiresAt, now())) return null;
      const token = await resolve(profileId, fresh);

      return token ? { token, record: fresh } : null;
    };
    const refreshToken = await resolveErgonRefreshToken(profileId, fresh);

    if (!refreshToken) return stillUsable();

    const refreshed = await (deps.refreshOAuth ?? defaultRefresh)(refreshToken);

    if (!refreshed.ok) return stillUsable();

    let next: ErgonConnectionRecord | null;

    try {
      next = await rotateErgonConnectionTokens(
        profileId,
        fresh.version,
        {
          token: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? refreshToken,
          expiresAt: refreshed.expiresAt,
          lastOkAt: new Date(now()).toISOString(),
        },
        store
      );
    } catch (error) {
      // The provider may already have rotated the refresh token. Serve this one request with
      // the new access token and surface the failure; do not report the connection healthy.
      logger.error("refresh", "Refreshed Ergon tokens could not be saved", {
        code: errorCode(error),
      });

      return { token: refreshed.accessToken, record: fresh };
    }

    if (next) {
      rotated = true;

      return { token: refreshed.accessToken, record: next };
    }

    // Lost the compare-and-swap: another writer changed the row (or the user disconnected).
    const winner = await load(profileId);

    if (!winner || needsRefresh(winner.expiresAt, now())) return null;

    const token = await resolve(profileId, winner);

    return token ? { token, record: winner } : null;
  } finally {
    // A successful rotation already cleared the lock. Releasing then could clear a newer holder.
    if (!rotated) {
      await releaseErgonRefreshLock(profileId, store).catch(() => {
        // The lock expires on its own.
      });
    }
  }
}

async function resolveUserAccessToken(
  profileId: string,
  record: ErgonConnectionRecord,
  deps: ErgonConfigDeps,
  load: (id: string) => Promise<ErgonConnectionRecord | null>
): Promise<Resolved | null> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const resolve =
    deps.resolveToken ??
    ((id: string, rec: ErgonConnectionRecord) => resolveErgonConnectionToken(id, rec));
  const deadline = now() + REFRESH_WAIT_MS;
  let current = record;

  for (;;) {
    if (!needsRefresh(current.expiresAt, now())) {
      const token = await resolve(profileId, current);

      return token ? { token, record: current } : null;
    }

    let claimed: boolean;

    try {
      claimed = await claimErgonRefreshLock(profileId, deps.storeOptions);
    } catch (error) {
      logger.error("refresh", "Could not claim the Ergon refresh lock", {
        code: errorCode(error),
      });

      if (reallyExpired(current.expiresAt, now())) return null;

      const token = await resolve(profileId, current);

      return token ? { token, record: current } : null;
    }

    if (claimed) return refreshHoldingLock(profileId, deps, load, resolve);

    // Another instance is refreshing. A token that has not truly expired is still good.
    if (!reallyExpired(current.expiresAt, now())) {
      const token = await resolve(profileId, current);

      return token ? { token, record: current } : null;
    }

    if (now() >= deadline) return null;

    await sleep(REFRESH_POLL_MS);

    const reloaded = await load(profileId);

    if (!reloaded) return null;
    current = reloaded;
  }
}

/**
 * Start one read of the user's Ergon connection. Never rejects: a store failure is logged (short
 * code only) and treated as "no tools this turn". Start it early and pass the promise down as
 * `connectionSnapshot` so the round trip overlaps work the turn does anyway.
 */
export function startErgonConnectionSnapshot(
  sbUserId: string,
  deps: Pick<ErgonConfigDeps, "loadConnection" | "storeOptions"> = {}
): Promise<ErgonConnectionRecord | null> {
  if (!sbUserId.trim()) return Promise.resolve(null);

  const load =
    deps.loadConnection ?? ((id: string) => loadErgonConnectionRecord(id, deps.storeOptions));

  return load(sbUserId).catch((error) => {
    logger.error("startErgonConnectionSnapshot", "Ergon connection unavailable", {
      code: errorCode(error),
    });

    return null;
  });
}

/**
 * Cheap turn-start gate for registering Ergon tools: the connection exists, has the scope, points
 * at a valid workspace, and its token opens locally. It never refreshes a token and never touches
 * the network, so an expired token cannot slow the start of a turn; the refresh happens inside the
 * tool call (`ergonConfigForUser`), which reads the latest row.
 */
export async function ergonToolsAvailable(
  sbUserId: string,
  purpose: ErgonConfigPurpose,
  deps: ErgonConfigDeps = {}
): Promise<boolean> {
  if (!sbUserId.trim()) return false;

  const requiredScope: ErgonConnectionScope = purpose === "tickets" ? "write" : "agents";

  try {
    const record = await (deps.connectionSnapshot ??
      (deps.loadConnection ?? ((id: string) => loadErgonConnectionRecord(id, deps.storeOptions)))(
        sbUserId
      ));

    if (
      !record ||
      !parseErgonWorkspaceUrl(record.url) ||
      !ergonScopesInclude(record.scopes, requiredScope)
    ) {
      return false;
    }

    const resolve = deps.resolveToken ?? resolveErgonConnectionToken;

    return Boolean(await resolve(sbUserId, record));
  } catch (error) {
    logger.error("ergonToolsAvailable", "Ergon connection unavailable", { code: errorCode(error) });

    return false;
  }
}

/**
 * Resolve Ergon credentials for one Organic profile, from that user's own durable OAuth
 * connection only. There is no deployment-wide or shared credential: no connection, no access.
 *
 * Store failures are logged and treated as "unavailable" for tools, never as a thrown error
 * into the chat turn.
 */
export async function ergonConfigForUser(
  sbUserId: string,
  purpose: ErgonConfigPurpose,
  deps: ErgonConfigDeps = {}
): Promise<ErgonConfig | null> {
  if (!sbUserId.trim()) return null;

  const requiredScope: ErgonConnectionScope = purpose === "tickets" ? "write" : "agents";
  const load =
    deps.loadConnection ?? ((id: string) => loadErgonConnectionRecord(id, deps.storeOptions));

  try {
    const record = await load(sbUserId);

    if (!record) return null;

    const url = parseErgonWorkspaceUrl(record.url);

    if (!url || !ergonScopesInclude(record.scopes, requiredScope)) return null;

    const resolved = await resolveUserAccessToken(sbUserId, record, deps, load);

    if (!resolved) return null;

    return {
      url,
      mcpUrl: parseErgonMcpUrl(resolved.record.mcpUrl) ?? mcpUrlForWorkspace(url),
      token: resolved.token,
      scopes: resolved.record.scopes,
    };
  } catch (error) {
    logger.error("ergonConfigForUser", "Ergon connection unavailable", {
      code: errorCode(error),
    });

    return null;
  }
}

/**
 * Public status helper for Settings / API — never exposes a token. Store failures THROW so
 * callers can report "temporarily unavailable" instead of showing a false "not connected".
 */
export async function ergonPublicStatusForUser(
  sbUserId: string,
  deps: ErgonConfigDeps = {}
): Promise<ErgonConnectionPublic> {
  const oauthReady = isErgonOAuthReady(deps.env);
  const load =
    deps.loadConnection ?? ((id: string) => loadErgonConnectionRecord(id, deps.storeOptions));
  const record = sbUserId.trim() ? await (deps.connectionSnapshot ?? load(sbUserId)) : null;

  if (!record) return toPublicErgonConnection(null, { oauthReady });

  const url = parseErgonWorkspaceUrl(record.url);
  // Report "connected" only if the stored token actually opens. A row sealed under another root
  // secret (or a plaintext row in production) would otherwise show Connected while every tool
  // is missing. This is a local decrypt; the token itself is never returned.
  const resolve = deps.resolveToken ?? resolveErgonConnectionToken;
  const usable = Boolean(url && (await resolve(sbUserId, record)));

  return {
    ...toPublicErgonConnection(record, { oauthReady }),
    connected: usable,
    hasToken: usable,
    url,
  };
}
