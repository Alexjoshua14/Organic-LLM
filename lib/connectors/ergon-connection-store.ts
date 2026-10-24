import "server-only";

import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import {
  ErgonConnectionRecordSchema,
  mcpUrlForWorkspace,
  uniqueErgonScopes,
  type ErgonAuthMode,
  type ErgonConnectionRecord,
  type ErgonConnectionScope,
  type ErgonTransport,
} from "@/lib/schemas/ergon-connection";

const memoryStore = new Map<string, ErgonConnectionRecord>();

function getStoreRootDir(customRootDir?: string): string {
  return customRootDir ?? path.join(process.cwd(), ".data", "ergon-connections");
}

function fileForUser(profileId: string, rootDir?: string): string {
  const safe = profileId.replace(/[^a-zA-Z0-9_-]/g, "_");

  return path.join(getStoreRootDir(rootDir), `${safe}.json`);
}

type TokenEnvelope =
  | { encrypted: true; ciphertext: string }
  | { encrypted: false; token: string };

function encryptToken(
  profileId: string,
  token: string,
  fieldName: "ergon_connection.token" | "ergon_connection.oauth"
): string {
  if (!process.env.ORGANIC_LLM_ROOT_SECRET) {
    return JSON.stringify({ encrypted: false, token } satisfies TokenEnvelope);
  }

  try {
    const ciphertext = encryptForStorage(token, {
      userId: profileId,
      threadId: "ergon-connection",
      fieldName,
    });

    return JSON.stringify({ encrypted: true, ciphertext } satisfies TokenEnvelope);
  } catch {
    return JSON.stringify({ encrypted: false, token } satisfies TokenEnvelope);
  }
}

function decryptToken(
  profileId: string,
  tokenCiphertext: string,
  fieldName: "ergon_connection.token" | "ergon_connection.oauth"
): string | null {
  try {
    const envelope = JSON.parse(tokenCiphertext) as TokenEnvelope;

    if (envelope.encrypted === true && typeof envelope.ciphertext === "string") {
      return decryptFromStorage(envelope.ciphertext, {
        userId: profileId,
        threadId: "ergon-connection",
        fieldName,
      });
    }

    if (envelope.encrypted === false && typeof envelope.token === "string") {
      return envelope.token;
    }

    return null;
  } catch {
    return null;
  }
}

function parseRecord(raw: string): ErgonConnectionRecord | null {
  try {
    const parsed = ErgonConnectionRecordSchema.safeParse(JSON.parse(raw));

    return parsed.success
      ? { ...parsed.data, scopes: uniqueErgonScopes(parsed.data.scopes) }
      : null;
  } catch {
    return null;
  }
}

export type ErgonConnectionStoreOptions = {
  rootDir?: string;
};

/**
 * Load a user's Ergon connection keyed by Supabase profile id.
 * Returns null when none is saved. Does not decrypt tokens.
 */
export async function loadErgonConnectionRecord(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<ErgonConnectionRecord | null> {
  const key = profileId.trim();

  if (!key) return null;

  const cached = memoryStore.get(key);

  if (cached && !options?.rootDir) return cached;

  try {
    const raw = await readFile(fileForUser(key, options?.rootDir), "utf8");
    const loaded = parseRecord(raw);

    if (loaded) {
      if (!options?.rootDir) memoryStore.set(key, loaded);

      return loaded;
    }
  } catch {
    // Missing file or unreadable — no connection.
  }

  return cached ?? null;
}

export async function resolveErgonConnectionToken(
  profileId: string,
  record: ErgonConnectionRecord
): Promise<string | null> {
  const token =
    decryptToken(profileId.trim(), record.tokenCiphertext, "ergon_connection.token")?.trim() ??
    null;

  return token || null;
}

export async function resolveErgonRefreshToken(
  profileId: string,
  record: ErgonConnectionRecord
): Promise<string | null> {
  if (!record.refreshTokenCiphertext) return null;

  const token =
    decryptToken(
      profileId.trim(),
      record.refreshTokenCiphertext,
      "ergon_connection.oauth"
    )?.trim() ?? null;

  return token || null;
}

export type SaveErgonConnectionInput = {
  url: string;
  mcpUrl?: string;
  /** Required when creating; omit to keep the existing ciphertext on update. */
  token?: string;
  refreshToken?: string | null;
  authMode?: ErgonAuthMode;
  transport?: ErgonTransport;
  scopes: readonly ErgonConnectionScope[];
  expiresAt?: string | null;
  lastOkAt?: string | null;
  connectedAt?: string;
};

/**
 * Create or update a per-user Ergon connection. Never stores raw tokens in the
 * returned/public record — only ciphertext.
 */
export async function saveErgonConnectionRecord(
  profileId: string,
  input: SaveErgonConnectionInput,
  options?: ErgonConnectionStoreOptions & { now?: () => number }
): Promise<ErgonConnectionRecord> {
  const key = profileId.trim();

  if (!key) {
    throw new Error("Supabase profile id is required to save an Ergon connection");
  }

  const existing = await loadErgonConnectionRecord(key, options);
  const nowIso = new Date((options?.now ?? Date.now)()).toISOString();
  const token = input.token?.trim();

  if (!token && !existing?.tokenCiphertext) {
    throw new Error("An Ergon access token is required to connect");
  }

  let refreshCiphertext = existing?.refreshTokenCiphertext ?? null;

  if (input.refreshToken !== undefined) {
    refreshCiphertext = input.refreshToken?.trim()
      ? encryptToken(key, input.refreshToken.trim(), "ergon_connection.oauth")
      : null;
  }

  const next: ErgonConnectionRecord = {
    url: input.url,
    mcpUrl: input.mcpUrl?.trim() || existing?.mcpUrl || mcpUrlForWorkspace(input.url),
    tokenCiphertext: token
      ? encryptToken(key, token, "ergon_connection.token")
      : existing!.tokenCiphertext,
    refreshTokenCiphertext: refreshCiphertext,
    authMode: input.authMode ?? existing?.authMode ?? "oauth",
    transport: input.transport ?? existing?.transport ?? "mcp",
    scopes: uniqueErgonScopes([...input.scopes]),
    expiresAt:
      input.expiresAt !== undefined ? input.expiresAt : (existing?.expiresAt ?? null),
    connectedAt: existing?.connectedAt ?? input.connectedAt ?? nowIso,
    lastOkAt:
      input.lastOkAt !== undefined ? input.lastOkAt : (existing?.lastOkAt ?? null),
  };

  const validated = ErgonConnectionRecordSchema.parse(next);

  if (!options?.rootDir) {
    memoryStore.set(key, validated);
  }

  try {
    const dir = getStoreRootDir(options?.rootDir);

    await mkdir(dir, { recursive: true });
    await writeFile(
      fileForUser(key, options?.rootDir),
      JSON.stringify(validated, null, 2),
      "utf8"
    );
  } catch {
    // Serverless / read-only FS: memory still holds the connection for this instance.
  }

  return validated;
}

export async function touchErgonConnectionLastOk(
  profileId: string,
  options?: ErgonConnectionStoreOptions & { now?: () => number }
): Promise<ErgonConnectionRecord | null> {
  const existing = await loadErgonConnectionRecord(profileId, options);

  if (!existing) return null;

  return saveErgonConnectionRecord(
    profileId,
    {
      url: existing.url,
      mcpUrl: existing.mcpUrl,
      scopes: existing.scopes,
      authMode: existing.authMode,
      transport: existing.transport,
      expiresAt: existing.expiresAt,
      lastOkAt: new Date((options?.now ?? Date.now)()).toISOString(),
    },
    options
  );
}

export async function deleteErgonConnectionRecord(
  profileId: string,
  options?: ErgonConnectionStoreOptions
): Promise<void> {
  const key = profileId.trim();

  if (!key) return;

  memoryStore.delete(key);

  try {
    await unlink(fileForUser(key, options?.rootDir));
  } catch {
    // Already gone.
  }
}

export function clearErgonConnectionMemoryStore(): void {
  memoryStore.clear();
}
