import "server-only";

import type { encryptForStorage } from "@/lib/crypto/message-encryption";

import {
  ErgonConnectionStoreError,
  getDefaultErgonConnectionRepo,
  type ErgonConnectionRepo,
  type ErgonConnectionRow,
} from "@/lib/connectors/ergon-connection-repo";
import {
  EncryptionRequiredError,
  openFromStorage,
  sealForStorage,
} from "@/lib/crypto/stored-payload";
import { createLogger } from "@/lib/logger";
import {
  ErgonConnectionRecordSchema,
  mcpUrlForWorkspace,
  uniqueErgonScopes,
  type ErgonConnectionRecord,
  type ErgonConnectionScope,
} from "@/lib/schemas/ergon-connection";

export { ErgonConnectionStoreError } from "@/lib/connectors/ergon-connection-repo";

const logger = createLogger("lib/connectors/ergon-connection-store.ts");

/**
 * Durable per-user Ergon connection, stored in `public.ergon_connections`.
 *
 * Ergon is a separate application. This row holds only what the signed-in user delegated
 * through the in-app OAuth connect flow: that user's own access/refresh tokens (ciphertext
 * only) plus connection metadata. The database is the single source of truth, so every
 * server instance sees the same connection. Nothing is cached in process memory or on disk.
 *
 * Failures are never swallowed: a failed save throws, so "connected" always means the row
 * exists. Callers must not treat a thrown error as "not connected".
 */

type TokenField = "ergon_connection.token" | "ergon_connection.oauth";

export type ErgonConnectionStoreOptions = {
  /** Injected for tests; defaults to the service-role Supabase repository. */
  repo?: ErgonConnectionRepo;
  now?: () => number;
  /** Injected for tests to simulate an encryption failure. */
  encrypt?: typeof encryptForStorage;
};

async function repoFrom(options?: ErgonConnectionStoreOptions): Promise<ErgonConnectionRepo> {
  return options?.repo ?? getDefaultErgonConnectionRepo();
}

const tokenContext = (profileId: string, fieldName: TokenField) => ({
  userId: profileId,
  threadId: "ergon-connection",
  fieldName,
});

function sealToken(
  profileId: string,
  token: string,
  fieldName: TokenField,
  encrypt?: typeof encryptForStorage
): string {
  try {
    return sealForStorage(token, tokenContext(profileId, fieldName), encrypt);
  } catch (error) {
    if (error instanceof EncryptionRequiredError) {
      logger.error("sealToken", "Refusing to store an Ergon token without encryption", {
        field: fieldName,
      });

      throw new ErgonConnectionStoreError("encrypt");
    }

    throw error;
  }
}

function openToken(profileId: string, stored: string, fieldName: TokenField): string | null {
  const token = openFromStorage(stored, tokenContext(profileId, fieldName))?.trim();

  if (token) return token;

  // Includes a ciphertext moved to another user's row (key and AAD are per user).
  logger.error("openToken", "Ergon token could not be opened", { field: fieldName });

  return null;
}

function recordFromRow(row: ErgonConnectionRow): ErgonConnectionRecord {
  const parsed = ErgonConnectionRecordSchema.safeParse({
    url: row.url,
    mcpUrl: row.mcp_url,
    tokenCiphertext: row.token_ciphertext,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    authMode: "oauth",
    transport: "mcp",
    scopes: uniqueErgonScopes(row.scopes as ErgonConnectionScope[]),
    expiresAt: row.expires_at,
    connectedAt: row.connected_at,
    lastOkAt: row.last_ok_at,
    version: row.version,
  });

  if (!parsed.success) throw new ErgonConnectionStoreError("corrupt_row");

  return parsed.data;
}

/**
 * Load a user's Ergon connection keyed by Supabase profile id. Returns null only when no
 * connection exists. Store failures throw. Does not decrypt tokens.
 */
export async function loadErgonConnectionRecord(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<ErgonConnectionRecord | null> {
  const key = profileId.trim();

  if (!key) return null;

  const row = await (await repoFrom(options)).get(key);

  return row ? recordFromRow(row) : null;
}

export async function resolveErgonConnectionToken(
  profileId: string,
  record: ErgonConnectionRecord
): Promise<string | null> {
  return openToken(profileId.trim(), record.tokenCiphertext, "ergon_connection.token");
}

export async function resolveErgonRefreshToken(
  profileId: string,
  record: ErgonConnectionRecord
): Promise<string | null> {
  if (!record.refreshTokenCiphertext) return null;

  return openToken(profileId.trim(), record.refreshTokenCiphertext, "ergon_connection.oauth");
}

export type SaveErgonConnectionInput = {
  url: string;
  mcpUrl?: string;
  token: string;
  refreshToken?: string | null;
  scopes: readonly ErgonConnectionScope[];
  expiresAt?: string | null;
  lastOkAt?: string | null;
};

/**
 * Create or replace a user's connection after a completed OAuth connect. Throws if the
 * write does not durably succeed; never returns plaintext tokens.
 */
export async function saveErgonConnectionRecord(
  profileId: string,
  input: SaveErgonConnectionInput,
  options?: ErgonConnectionStoreOptions
): Promise<ErgonConnectionRecord> {
  const key = profileId.trim();

  if (!key) throw new ErgonConnectionStoreError("invalid_owner");

  const token = input.token.trim();

  if (!token) throw new ErgonConnectionStoreError("missing_token");

  const refresh = input.refreshToken?.trim();
  const nowIso = new Date((options?.now ?? Date.now)()).toISOString();
  const row = await (
    await repoFrom(options)
  ).upsert(key, {
    url: input.url,
    mcp_url: input.mcpUrl?.trim() || mcpUrlForWorkspace(input.url),
    scopes: uniqueErgonScopes([...input.scopes]),
    token_ciphertext: sealToken(key, token, "ergon_connection.token", options?.encrypt),
    refresh_token_ciphertext: refresh
      ? sealToken(key, refresh, "ergon_connection.oauth", options?.encrypt)
      : null,
    expires_at: input.expiresAt ?? null,
    connected_at: nowIso,
    last_ok_at: input.lastOkAt ?? null,
  });

  return recordFromRow(row);
}

export type RotateErgonTokensInput = {
  token: string;
  /** Pass the existing refresh token when the provider did not rotate it. */
  refreshToken: string | null;
  expiresAt: string | null;
  lastOkAt?: string | null;
};

/**
 * Persist refreshed tokens only if the row is still at `expectedVersion`. Returns the new
 * record, or null when another writer (or a disconnect) changed the row first.
 */
export async function rotateErgonConnectionTokens(
  profileId: string,
  expectedVersion: number,
  input: RotateErgonTokensInput,
  options?: ErgonConnectionStoreOptions
): Promise<ErgonConnectionRecord | null> {
  const key = profileId.trim();

  if (!key) throw new ErgonConnectionStoreError("invalid_owner");

  const token = input.token.trim();

  if (!token) throw new ErgonConnectionStoreError("missing_token");

  const refresh = input.refreshToken?.trim();
  const row = await (
    await repoFrom(options)
  ).rotate(key, expectedVersion, {
    token_ciphertext: sealToken(key, token, "ergon_connection.token", options?.encrypt),
    refresh_token_ciphertext: refresh
      ? sealToken(key, refresh, "ergon_connection.oauth", options?.encrypt)
      : null,
    expires_at: input.expiresAt,
    last_ok_at: input.lastOkAt ?? null,
  });

  return row ? recordFromRow(row) : null;
}

/** Refresh-lock TTL: longer than the 15s token-endpoint timeout, short enough to self-heal. */
export const ERGON_REFRESH_LOCK_TTL_SECONDS = 45;

export async function claimErgonRefreshLock(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<boolean> {
  return (await repoFrom(options)).claimRefreshLock(
    profileId.trim(),
    ERGON_REFRESH_LOCK_TTL_SECONDS
  );
}

export async function releaseErgonRefreshLock(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<void> {
  await (await repoFrom(options)).releaseRefreshLock(profileId.trim());
}

export async function touchErgonConnectionLastOk(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<void> {
  const key = profileId.trim();

  if (!key) return;

  await (
    await repoFrom(options)
  ).touchLastOk(key, new Date((options?.now ?? Date.now)()).toISOString());
}

/** Deletes the user's stored credentials. Throws on failure so Disconnect never lies. */
export async function deleteErgonConnectionRecord(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<void> {
  const key = profileId.trim();

  if (!key) return;

  await (await repoFrom(options)).remove(key);
}
