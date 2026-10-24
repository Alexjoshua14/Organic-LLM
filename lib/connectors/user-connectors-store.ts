import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import {
  defaultUserConnectorsProfile,
  normalizeUserConnectorsProfile,
  UserConnectorsProfileSchema,
  type UserConnectorsProfile,
  type UserConnectorsProfileInput,
} from "@/lib/schemas/user-connectors";
import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";

const memoryStore = new Map<string, UserConnectorsProfile>();

function getStoreRootDir(customRootDir?: string): string {
  return customRootDir ?? path.join(process.cwd(), ".data", "user-connectors");
}

function fileForUser(userId: string, rootDir?: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");

  return path.join(getStoreRootDir(rootDir), `${safe}.json`);
}

function tryEncryptPayload(userId: string, payload: UserConnectorsProfile): string {
  const plaintext = JSON.stringify(payload);

  if (!process.env.ORGANIC_LLM_ROOT_SECRET) {
    return JSON.stringify({ encrypted: false, data: payload }, null, 2);
  }

  try {
    const ciphertext = encryptForStorage(plaintext, {
      userId,
      threadId: "user-connectors",
      fieldName: "user_connectors.profile",
    });

    return JSON.stringify({ encrypted: true, ciphertext }, null, 2);
  } catch {
    return JSON.stringify({ encrypted: false, data: payload }, null, 2);
  }
}

function tryDecryptPayload(userId: string, rawFileContent: string): UserConnectorsProfile | null {
  try {
    const envelope = JSON.parse(rawFileContent) as {
      encrypted?: boolean;
      ciphertext?: string;
      data?: unknown;
    };

    if (envelope.encrypted && typeof envelope.ciphertext === "string") {
      const decrypted = decryptFromStorage(envelope.ciphertext, {
        userId,
        threadId: "user-connectors",
        fieldName: "user_connectors.profile",
      });
      const parsed = UserConnectorsProfileSchema.safeParse(JSON.parse(decrypted));

      return parsed.success ? normalizeUserConnectorsProfile(parsed.data) : null;
    }

    const candidate = envelope.data ?? envelope;
    const parsed = UserConnectorsProfileSchema.safeParse(candidate);

    return parsed.success ? normalizeUserConnectorsProfile(parsed.data) : null;
  } catch {
    return null;
  }
}

export type UserConnectorsStoreOptions = {
  rootDir?: string;
};

/**
 * Load a user's private connectors & personal dossier from the server store
 * (in-memory cache + encrypted local file persistence under `.data/user-connectors/`).
 */
export async function loadUserConnectorsProfile(
  userId: string,
  options?: UserConnectorsStoreOptions
): Promise<UserConnectorsProfile> {
  const key = userId.trim();

  if (!key) return defaultUserConnectorsProfile();

  const cached = memoryStore.get(key);

  if (cached && !options?.rootDir) {
    return cached;
  }

  try {
    const raw = await readFile(fileForUser(key, options?.rootDir), "utf8");
    const loaded = tryDecryptPayload(key, raw);

    if (loaded) {
      if (!options?.rootDir) memoryStore.set(key, loaded);

      return loaded;
    }
  } catch {
    // File does not exist yet or cannot be read; fall through to default.
  }

  return cached ?? defaultUserConnectorsProfile();
}

/**
 * Save a user's private connectors & personal dossier to the server store.
 */
export async function saveUserConnectorsProfile(
  userId: string,
  input: Partial<UserConnectorsProfileInput>,
  options?: UserConnectorsStoreOptions & { now?: () => number }
): Promise<UserConnectorsProfile> {
  const key = userId.trim();

  if (!key) {
    return normalizeUserConnectorsProfile(input);
  }

  const existing = await loadUserConnectorsProfile(key, options);
  const nowIso = new Date((options?.now ?? Date.now)()).toISOString();
  const next = normalizeUserConnectorsProfile(
    {
      ...input,
      updatedAt: nowIso,
    },
    existing
  );

  if (!options?.rootDir) {
    memoryStore.set(key, next);
  }

  try {
    const dir = getStoreRootDir(options?.rootDir);

    await mkdir(dir, { recursive: true });
    await writeFile(fileForUser(key, options?.rootDir), tryEncryptPayload(key, next), "utf8");
  } catch {
    // If filesystem is read-only (e.g. serverless edge), in-memory store still holds it for the instance.
  }

  return next;
}

export function clearUserConnectorsMemoryStore(): void {
  memoryStore.clear();
}
