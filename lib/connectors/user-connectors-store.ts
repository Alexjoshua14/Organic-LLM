import "server-only";

import type { encryptForStorage } from "@/lib/crypto/message-encryption";

import {
  getDefaultUserConnectorsRepo,
  UserConnectorsStoreError,
  type UserConnectorsRepo,
} from "@/lib/connectors/user-connectors-repo";
import {
  EncryptionRequiredError,
  openFromStorage,
  sealForStorage,
} from "@/lib/crypto/stored-payload";
import { createLogger } from "@/lib/logger";
import {
  defaultUserConnectorsProfile,
  normalizeUserConnectorsProfile,
  UserConnectorsProfileSchema,
  type UserConnectorsProfile,
  type UserConnectorsProfileInput,
} from "@/lib/schemas/user-connectors";

export { UserConnectorsStoreError } from "@/lib/connectors/user-connectors-repo";

const logger = createLogger("lib/connectors/user-connectors-store.ts");

/**
 * A user's private connectors profile (dossier + connector handles), stored durably in
 * `public.user_connectors_profiles`, keyed by the Organic profile id (never an auth-provider id).
 *
 * The whole profile is one encrypted JSON document. The document is open: fields this build does
 * not know are carried through every save untouched, so a newer deploy's (or an experiment's)
 * fields survive an older instance's write. Nothing is cached in process memory or on disk, so
 * every server instance sees the same profile.
 *
 * Failures are never swallowed. A load that cannot read or open the stored profile throws rather
 * than returning defaults, because the next save would otherwise overwrite real data with them.
 * `ergonConnection` is never stored: it is derived from the durable Ergon connection on read.
 */

const PAYLOAD_SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = "_schema";
const MAX_SAVE_ATTEMPTS = 3;
const KNOWN_KEYS = new Set<string>([
  ...Object.keys(UserConnectorsProfileSchema.shape),
  SCHEMA_VERSION_KEY,
]);

export type UserConnectorsStoreOptions = {
  /** Injected for tests; defaults to the service-role Supabase repository. */
  repo?: UserConnectorsRepo;
  now?: () => number;
  /** Injected for tests to simulate an encryption failure. */
  encrypt?: typeof encryptForStorage;
};

const payloadContext = (profileId: string) => ({
  userId: profileId,
  threadId: "user-connectors",
  fieldName: "user_connectors.profile" as const,
});

type Decoded = { profile: UserConnectorsProfile; extras: Record<string, unknown> };

function decode(profileId: string, ciphertext: string): Decoded {
  const plaintext = openFromStorage(ciphertext, payloadContext(profileId));

  if (plaintext === null) {
    logger.error("decode", "Stored connectors profile could not be opened");

    throw new UserConnectorsStoreError("decrypt");
  }

  let raw: unknown;

  try {
    raw = JSON.parse(plaintext);
  } catch {
    throw new UserConnectorsStoreError("corrupt_row");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UserConnectorsStoreError("corrupt_row");
  }

  // Stored values were normalized on write, so a single schema parse is enough on the read path.
  const parsed = UserConnectorsProfileSchema.safeParse(raw);

  if (!parsed.success) {
    logger.error("decode", "Stored connectors profile does not match the schema");

    throw new UserConnectorsStoreError("corrupt_row");
  }

  const extras: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(key)) extras[key] = value;
  }

  return { profile: { ...parsed.data, ergonConnection: null }, extras };
}

/**
 * Load a user's connectors profile by Organic profile id. Returns the empty default only when
 * no profile has been saved. Store failures throw `UserConnectorsStoreError`.
 */
export async function loadUserConnectorsProfile(
  profileId: string,
  options?: UserConnectorsStoreOptions
): Promise<UserConnectorsProfile> {
  const key = profileId.trim();

  if (!key) return defaultUserConnectorsProfile();

  const repo = options?.repo ?? (await getDefaultUserConnectorsRepo());
  const row = await repo.get(key);

  return row ? decode(key, row.payload_ciphertext).profile : defaultUserConnectorsProfile();
}

/**
 * Merge `input` into the user's stored profile and persist it. Concurrent saves are detected with
 * a version compare-and-swap and re-merged, so one writer never drops another's fields. Throws if
 * the write does not durably succeed.
 */
export async function saveUserConnectorsProfile(
  profileId: string,
  input: Partial<UserConnectorsProfileInput>,
  options?: UserConnectorsStoreOptions
): Promise<UserConnectorsProfile> {
  const key = profileId.trim();

  if (!key) throw new UserConnectorsStoreError("invalid_owner");

  const repo = options?.repo ?? (await getDefaultUserConnectorsRepo());
  const nowIso = new Date((options?.now ?? Date.now)()).toISOString();

  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const row = await repo.get(key);
    const existing = row ? decode(key, row.payload_ciphertext) : null;
    const next = {
      ...normalizeUserConnectorsProfile(
        { ...input, updatedAt: nowIso },
        existing?.profile ?? undefined
      ),
      // Derived on read from the durable Ergon connection; never persisted.
      ergonConnection: null,
    };
    let ciphertext: string;

    try {
      ciphertext = sealForStorage(
        JSON.stringify({
          ...existing?.extras,
          ...next,
          [SCHEMA_VERSION_KEY]: PAYLOAD_SCHEMA_VERSION,
        }),
        payloadContext(key),
        options?.encrypt
      );
    } catch (error) {
      if (error instanceof EncryptionRequiredError) {
        logger.error("save", "Refusing to store a connectors profile without encryption");

        throw new UserConnectorsStoreError("encrypt");
      }

      throw error;
    }

    const written = row
      ? await repo.update(key, row.version, ciphertext)
      : await repo.insert(key, ciphertext);

    if (written) return next;
  }

  throw new UserConnectorsStoreError("conflict");
}
