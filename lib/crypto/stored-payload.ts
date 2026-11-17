import "server-only";

import {
  decryptFromStorage,
  encryptForStorage,
  type EncryptionContext,
} from "@/lib/crypto/message-encryption";

const ENCRYPTED_PREFIX = "enc:";
/** Development/test only. Never written or accepted when NODE_ENV is production. */
const PLAINTEXT_PREFIX = "plain:";

export class EncryptionRequiredError extends Error {
  constructor() {
    super("Refusing to store a value without encryption");
    this.name = "EncryptionRequiredError";
  }
}

/**
 * Vercel previews also run with NODE_ENV=production, so previews are covered. In production a
 * value must be encrypted or the write is refused, and a plaintext value is never accepted.
 */
export function encryptionRequired(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Encrypt `plaintext` for a database column, bound to `context` (per-user key and AAD).
 * Outside production, falls back to a marked plaintext value when encryption is unavailable.
 * Throws `EncryptionRequiredError` in production instead of ever storing plaintext.
 * `encrypt` is injectable for tests.
 */
export function sealForStorage(
  plaintext: string,
  context: EncryptionContext,
  encrypt: typeof encryptForStorage = encryptForStorage
): string {
  try {
    const ciphertext = encrypt(plaintext, context);

    if (ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext;
  } catch {
    // Handled below: production refuses to continue without encryption.
  }

  if (encryptionRequired()) throw new EncryptionRequiredError();

  return `${PLAINTEXT_PREFIX}${plaintext}`;
}

/**
 * Open a value written by `sealForStorage`. Returns null (never throws) when the value cannot
 * be opened: wrong user or field, a different key, tampering, or plaintext in production.
 * Callers decide how loudly to report that; nothing about the value is logged here.
 */
export function openFromStorage(stored: string, context: EncryptionContext): string | null {
  if (stored.startsWith(ENCRYPTED_PREFIX)) {
    try {
      return decryptFromStorage(stored, context);
    } catch {
      return null;
    }
  }

  if (stored.startsWith(PLAINTEXT_PREFIX) && !encryptionRequired()) {
    return stored.slice(PLAINTEXT_PREFIX.length);
  }

  return null;
}
