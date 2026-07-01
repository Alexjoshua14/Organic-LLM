"use client";

import type { StrataSectionKey } from "@/lib/schemas/strata";
import { fromBase64, toBase64 } from "@/lib/crypto/web-crypto-bytes";

const ENCRYPTED_PREFIX = "enc";
const PAYLOAD_VERSION = "v1";
const AES_ALGORITHM = "AES-GCM";
const AES_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const ROOT_KEY_STORAGE_KEY = "strata:local-root-secret:v1";
const HKDF_SALT = "organic-llm-message-encryption";
const HKDF_INFO_PREFIX = "organic-llm-user-encryption";

type LocalEncryptionContext = {
  pageId: string;
  sectionKey: StrataSectionKey;
};

function getOrCreateLocalRootSecret(): Uint8Array {
  const existing = globalThis.localStorage.getItem(ROOT_KEY_STORAGE_KEY);

  if (existing) return fromBase64(existing);

  const seed = crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES));

  globalThis.localStorage.setItem(ROOT_KEY_STORAGE_KEY, toBase64(seed));

  return seed;
}

function buildAad(context: LocalEncryptionContext): Uint8Array {
  return new TextEncoder().encode(`local-device:${context.pageId}:strata.${context.sectionKey}`);
}

async function deriveSectionCryptoKey(context: LocalEncryptionContext): Promise<CryptoKey> {
  const secret = getOrCreateLocalRootSecret();
  const baseKey = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(HKDF_SALT),
      info: new TextEncoder().encode(`${HKDF_INFO_PREFIX}:local-device:${context.pageId}`),
    },
    baseKey,
    {
      name: AES_ALGORITHM,
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptStrataSectionForLocalStorage(
  plaintext: string,
  context: LocalEncryptionContext
): Promise<string> {
  const key = await deriveSectionCryptoKey(context);
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

export async function decryptStrataSectionFromLocalStorage(
  payload: string,
  context: LocalEncryptionContext
): Promise<string> {
  if (!payload.startsWith(`${ENCRYPTED_PREFIX}:`)) return payload;

  const parts = payload.split(":");

  if (parts.length !== 4) throw new Error("Malformed encrypted local Strata payload");
  const [, version, ivB64, cipherB64] = parts;

  if (version !== PAYLOAD_VERSION)
    throw new Error(`Unsupported Strata payload version: ${version}`);

  const key = await deriveSectionCryptoKey(context);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(cipherB64);
  const aad = buildAad(context);

  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv, additionalData: aad },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
