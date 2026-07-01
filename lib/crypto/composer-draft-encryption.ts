"use client";

import { getOrCreateDeviceRootKey } from "@/lib/crypto/composer-device-key";
import { fromBase64, toBase64 } from "@/lib/crypto/web-crypto-bytes";

const ENCRYPTED_PREFIX = "enc";
const PAYLOAD_VERSION = "v1";
const AES_ALGORITHM = "AES-GCM";
const AES_GCM_IV_BYTES = 12;
const HKDF_SALT = "organic-llm-composer-draft";
const HKDF_INFO_PREFIX = "organic-llm-composer-draft";

export type ComposerDraftEncryptionContext = {
  chatId: string;
  userId?: string | null;
};

function resolveUserLabel(userId: string | null | undefined): string {
  return userId?.trim() ? userId.trim() : "anon";
}

function buildAad(context: ComposerDraftEncryptionContext): Uint8Array {
  const userLabel = resolveUserLabel(context.userId);

  return new TextEncoder().encode(
    `${HKDF_INFO_PREFIX}:${userLabel}:${context.chatId}`
  );
}

function buildHkdfInfo(context: ComposerDraftEncryptionContext): Uint8Array {
  const userLabel = resolveUserLabel(context.userId);

  return new TextEncoder().encode(`${HKDF_INFO_PREFIX}:${userLabel}:${context.chatId}`);
}

async function deriveDraftCryptoKey(context: ComposerDraftEncryptionContext): Promise<CryptoKey> {
  const rootKey = await getOrCreateDeviceRootKey();

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(HKDF_SALT),
      info: buildHkdfInfo(context),
    },
    rootKey,
    {
      name: AES_ALGORITHM,
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptComposerDraft(
  plaintext: string,
  context: ComposerDraftEncryptionContext
): Promise<string> {
  const key = await deriveDraftCryptoKey(context);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const aad = buildAad(context);
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv, additionalData: aad },
    key,
    new TextEncoder().encode(plaintext)
  );

  return [
    ENCRYPTED_PREFIX,
    PAYLOAD_VERSION,
    toBase64(iv),
    toBase64(new Uint8Array(encrypted)),
  ].join(":");
}

export async function decryptComposerDraft(
  payload: string,
  context: ComposerDraftEncryptionContext
): Promise<string | null> {
  if (!payload.startsWith(`${ENCRYPTED_PREFIX}:`)) return payload;

  const parts = payload.split(":");

  if (parts.length !== 4) return null;

  const [, version, ivB64, cipherB64] = parts;

  if (version !== PAYLOAD_VERSION) return null;

  try {
    const key = await deriveDraftCryptoKey(context);
    const iv = fromBase64(ivB64);
    const ciphertext = fromBase64(cipherB64);
    const aad = buildAad(context);

    const decrypted = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv, additionalData: aad },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
