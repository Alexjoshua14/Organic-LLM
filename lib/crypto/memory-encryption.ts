/**
 * Memory field encryption (AES-256-GCM), Node `crypto` only.
 *
 * Environment (rotation):
 * - `MEMORY_ENCRYPTION_CURRENT_KEY` — active version for new ciphertexts, e.g. `k1`.
 * - `MEMORY_ENCRYPTION_KEY_K1`, `MEMORY_ENCRYPTION_KEY_K2`, … — **standard padded base64**
 *   encoding **at least 32 bytes of random key material after decode** (IKM for HKDF).
 *   Use `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
 *   **Passphrases / plain UTF-8 secrets are not supported** — they will fail base64 validation
 *   or length checks with errors that point here.
 *
 * Payload wire format: `v1:<keyVersion>:<ivB64>:<tagB64>:<ctB64>`.
 */
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

  // Node's Buffer.from accepts unpadded / loosely-valid base64; we require standard padded
  // length (multiple of 4) so ciphertexts and env keys are unambiguous and corruption is obvious.
  if (value.length > 0 && value.length % 4 !== 0) {
    throw new Error(`Invalid ${label} encoding`);
  }

  return Buffer.from(value, "base64");
}

function decodeIkmFromEnv(raw: string, envVar: string): Buffer {
  let ikm: Buffer;

  try {
    ikm = decodeBase64(raw, envVar);
  } catch (err) {
    throw new Error(
      `${envVar} must be standard padded base64 of at least ${AES_KEY_BYTES} random bytes after decode ` +
        `(use \`openssl rand -base64 32\`). Passphrases and non-base64 strings are not supported.`,
      { cause: err }
    );
  }

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
  const salt = new Uint8Array(Buffer.from(HKDF_SALT, "utf8"));
  const info = new Uint8Array(Buffer.from(HKDF_INFO, "utf8"));
  const derived = Buffer.from(hkdfSync("sha256", new Uint8Array(ikm), salt, info, AES_KEY_BYTES));

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
  const cipher = createCipheriv(AES_ALGORITHM, new Uint8Array(key), new Uint8Array(iv));

  cipher.setAAD(new Uint8Array(MEMORY_AAD));

  const ct1 = cipher.update(plaintext, "utf8");
  const ct2 = cipher.final();
  const ciphertext = Buffer.concat([new Uint8Array(ct1), new Uint8Array(ct2)]);
  const tag = Buffer.from(new Uint8Array(cipher.getAuthTag()));

  return serializePayload(keyVersion, iv, tag, ciphertext);
}

export function decryptMemory(encrypted: string): string {
  const payload = parseMemoryPayload(encrypted);
  const key = getMemoryAesKey(payload.keyVersion);

  try {
    const decipher = createDecipheriv(
      AES_ALGORITHM,
      new Uint8Array(key),
      new Uint8Array(payload.iv)
    );

    decipher.setAAD(new Uint8Array(MEMORY_AAD));
    decipher.setAuthTag(new Uint8Array(payload.tag));

    const d1 = decipher.update(new Uint8Array(payload.ciphertext));
    const d2 = decipher.final();
    const plaintext = Buffer.concat([new Uint8Array(d1), new Uint8Array(d2)]);

    return plaintext.toString("utf8");
  } catch (err) {
    throw new Error(
      `Memory decryption failed (key=${payload.keyVersion}): ciphertext may have been tampered with or the key is wrong`,
      { cause: err }
    );
  }
}

/**
 * Re-encrypts a payload under the current key version.
 *
 * @throws {MemoryKeyNotFoundError} if the original key version's env var is unset
 * @throws {Error} if the original ciphertext is malformed or tampered (from {@link decryptMemory}),
 *   or if {@link encryptMemory} fails (e.g. missing or invalid `MEMORY_ENCRYPTION_CURRENT_KEY`)
 *
 * Used by rotation migrations to upgrade old ciphertexts.
 */
export function reencryptMemory(encrypted: string): string {
  const plaintext = decryptMemory(encrypted);

  return encryptMemory(plaintext);
}

/**
 * Returns true if the ciphertext was encrypted under the current key version.
 * Used by rotation migrations to skip already-rotated entries.
 *
 * `getCurrentKeyVersion()` runs outside the parse try/catch so missing or invalid
 * `MEMORY_ENCRYPTION_CURRENT_KEY` throws instead of being treated as "not current".
 */
export function isEncryptedWithCurrentKey(encrypted: string): boolean {
  const currentVersion = getCurrentKeyVersion();

  try {
    const payload = parseMemoryPayload(encrypted);

    return payload.keyVersion === currentVersion;
  } catch {
    return false;
  }
}
