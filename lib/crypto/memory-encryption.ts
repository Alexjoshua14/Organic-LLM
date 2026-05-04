import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PAYLOAD_VERSION = "v1";
const KEY_VERSION_PREFIX = "k";
const ENV_KEY_PREFIX = "MEMORY_ENCRYPTION_KEY_K";
const ENV_CURRENT_KEY = "MEMORY_ENCRYPTION_CURRENT_KEY";

const AES_ALGORITHM = "aes-256-gcm";
const AES_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const HKDF_SALT = "organic-llm-memory-encryption";
const HKDF_INFO = "organic-llm-memory-aes256gcm-v1";
const MEMORY_AAD = Buffer.from("organic-llm-memory:v1", "utf8");

const KEY_VERSION_RE = /^k\d+$/;

/** Standard base64 (RFC 4648 alphabet + padding). Node's Buffer.from does not throw on garbage; this gates decode. */
const BASE64_STANDARD_RE = /^[A-Za-z0-9+/]*={0,2}$/;

const keyCache = new Map<KeyVersion, Buffer>();

/**
 * Clears cached HKDF-derived AES keys. Call after changing memory key env vars
 * (e.g. rotation) so the next encrypt/decrypt re-reads the environment.
 * Intended for tests and dev workflows; production keys rarely change at runtime.
 */
export function resetMemoryEncryptionKeyCache(): void {
  keyCache.clear();
}

export type KeyVersion = `k${number}`;

export class MemoryKeyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryKeyNotFoundError";
  }
}

export type ParsedMemoryPayload = {
  version: typeof PAYLOAD_VERSION;
  keyVersion: KeyVersion;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

function decodeBase64(value: string, label: string): Buffer {
  if (!BASE64_STANDARD_RE.test(value)) {
    throw new Error(`Invalid ${label} encoding`);
  }

  if (value.length > 0 && value.length % 4 !== 0) {
    throw new Error(`Invalid ${label} encoding`);
  }

  return Buffer.from(value, "base64");
}

function decodeIkmFromEnv(raw: string, envVar: string): Buffer {
  const ikm = decodeBase64(raw, envVar);

  if (ikm.length < AES_KEY_BYTES) {
    throw new Error(
      `${envVar} must be at least ${AES_KEY_BYTES} bytes of base64-encoded random data (got ${ikm.length} bytes)`
    );
  }

  return ikm;
}

function memoryKeyEnvName(version: KeyVersion): string {
  return `${ENV_KEY_PREFIX}${version.slice(KEY_VERSION_PREFIX.length).toUpperCase()}`;
}

function getMemoryAesKey(version: KeyVersion): Buffer {
  const cached = keyCache.get(version);
  if (cached) {
    return cached;
  }

  const envVar = memoryKeyEnvName(version);
  const raw = process.env[envVar];

  if (raw == null || raw.trim().length === 0) {
    throw new MemoryKeyNotFoundError(
      `Memory encryption key ${version} is not available. ` +
        `Set ${envVar} to enable decryption of memories using this key version.`
    );
  }

  const ikm = decodeIkmFromEnv(raw.trim(), envVar);
  const derived = Buffer.from(
    hkdfSync("sha256", ikm, Buffer.from(HKDF_SALT, "utf8"), Buffer.from(HKDF_INFO, "utf8"), AES_KEY_BYTES)
  );

  if (derived.length !== AES_KEY_BYTES) {
    throw new Error(`Memory encryption key derivation produced invalid length: ${derived.length}`);
  }

  keyCache.set(version, derived);
  return derived;
}

function getCurrentKeyVersion(): KeyVersion {
  const current = process.env[ENV_CURRENT_KEY];

  if (current == null || current.trim().length === 0) {
    throw new Error(`Missing ${ENV_CURRENT_KEY}`);
  }

  const trimmed = current.trim();

  if (!KEY_VERSION_RE.test(trimmed)) {
    throw new Error(`${ENV_CURRENT_KEY} must be of form 'k<number>' (e.g., 'k1'); got: ${trimmed}`);
  }

  return trimmed as KeyVersion;
}

function serializePayload(
  keyVersion: KeyVersion,
  iv: Buffer,
  tag: Buffer,
  ciphertext: Buffer
): string {
  return [
    PAYLOAD_VERSION,
    keyVersion,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function parseMemoryPayload(value: string): ParsedMemoryPayload {
  const parts = value.split(":");

  if (parts.length !== 5) {
    throw new Error("Malformed memory encrypted payload");
  }

  const [version, keyVersion, ivB64, tagB64, ciphertextB64] = parts;

  if (version !== PAYLOAD_VERSION) {
    throw new Error(`Unsupported memory encrypted payload version: ${version}`);
  }

  if (!KEY_VERSION_RE.test(keyVersion)) {
    throw new Error(`Invalid key version in payload: ${keyVersion}`);
  }

  const iv = decodeBase64(ivB64, "iv");
  const tag = decodeBase64(tagB64, "auth tag");
  const ciphertext = decodeBase64(ciphertextB64, "ciphertext");

  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error("Memory encrypted payload iv has invalid length");
  }

  if (tag.length !== AES_GCM_TAG_BYTES) {
    throw new Error("Memory encrypted payload auth tag has invalid length");
  }

  return {
    version: PAYLOAD_VERSION,
    keyVersion: keyVersion as KeyVersion,
    iv,
    tag,
    ciphertext,
  };
}

/**
 * Heuristic: true if `text` looks like a v1 memory ciphertext (`v1:keyVersion:iv:tag:ct`).
 * The ciphertext segment may be empty base64 when plaintext was empty.
 * User-supplied plaintext could theoretically match; use only for migration hints.
 */
export function isEncrypted(text: string): boolean {
  if (!text.startsWith(`${PAYLOAD_VERSION}:`)) {
    return false;
  }

  const parts = text.split(":");

  if (parts.length !== 5) {
    return false;
  }

  const [, keyVersion, ivB64, tagB64] = parts;

  return (
    parts[0] === PAYLOAD_VERSION &&
    KEY_VERSION_RE.test(keyVersion) &&
    ivB64.length > 0 &&
    tagB64.length > 0
  );
}

export function encryptMemory(plaintext: string): string {
  const keyVersion = getCurrentKeyVersion();
  const key = getMemoryAesKey(keyVersion);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);

  cipher.setAAD(MEMORY_AAD);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return serializePayload(keyVersion, iv, tag, ciphertext);
}

export function decryptMemory(encrypted: string): string {
  const payload = parseMemoryPayload(encrypted);
  const key = getMemoryAesKey(payload.keyVersion);

  try {
    const decipher = createDecipheriv(AES_ALGORITHM, key, payload.iv);

    decipher.setAAD(MEMORY_AAD);
    decipher.setAuthTag(payload.tag);

    const plaintext = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);

    return plaintext.toString("utf8");
  } catch (err) {
    throw new Error(
      "Memory decryption failed: ciphertext may have been tampered with or the key is wrong",
      { cause: err }
    );
  }
}

/**
 * Re-encrypts a payload under the current key version.
 * Used by rotation migrations to upgrade old ciphertexts.
 */
export function reencryptMemory(encrypted: string): string {
  const plaintext = decryptMemory(encrypted);
  return encryptMemory(plaintext);
}

/**
 * Returns true if the ciphertext was encrypted under the current key version.
 * Used by rotation migrations to skip already-rotated entries.
 */
export function isEncryptedWithCurrentKey(encrypted: string): boolean {
  try {
    const payload = parseMemoryPayload(encrypted);
    return payload.keyVersion === getCurrentKeyVersion();
  } catch {
    return false;
  }
}
