import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

import {
  AES_ALGORITHM,
  AES_GCM_IV_BYTES,
  AES_GCM_TAG_BYTES,
  AES_KEY_BYTES,
  WIRE_PREFIX,
  WIRE_VERSION,
} from "./constants";
import type { IntrospectionBootstrapPayload } from "./schemas";
import { IntrospectionBootstrapPayloadSchema } from "./schemas";

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string, label: string): Uint8Array {
  try {
    return new Uint8Array(Buffer.from(value, "base64url"));
  } catch {
    throw new Error(`Invalid ${label} encoding`);
  }
}

export function decodeSharedSecret(raw: string): Uint8Array {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error("INTROSPECTION_ORGANIC_SHARED_SECRET is not configured");
  }

  let bytes: Uint8Array;

  try {
    bytes = new Uint8Array(Buffer.from(trimmed, "base64"));
  } catch {
    bytes = new Uint8Array(Buffer.from(trimmed, "utf8"));
  }

  if (bytes.length < AES_KEY_BYTES) {
    throw new Error("INTROSPECTION_ORGANIC_SHARED_SECRET must decode to at least 32 bytes");
  }

  return bytes.slice(0, AES_KEY_BYTES);
}

export function getSharedSecretKeyFromEnv(
  envValue: string | undefined = process.env.INTROSPECTION_ORGANIC_SHARED_SECRET,
): Uint8Array {
  return decodeSharedSecret(envValue ?? "");
}

export type EncryptBootstrapOptions = {
  secret?: string;
  iv?: Uint8Array;
};

export function encryptBootstrapPayload(
  payload: IntrospectionBootstrapPayload,
  options?: EncryptBootstrapOptions,
): string {
  const parsed = IntrospectionBootstrapPayloadSchema.parse(payload);
  const key = getSharedSecretKeyFromEnv(options?.secret);
  const ivBytes = options?.iv ?? new Uint8Array(randomBytes(AES_GCM_IV_BYTES));
  const cipher = createCipheriv(AES_ALGORITHM, key, ivBytes);
  const plaintext = new TextEncoder().encode(JSON.stringify(parsed));
  const ciphertext = concatBytes([
    new Uint8Array(cipher.update(plaintext)),
    new Uint8Array(cipher.final()),
  ]);
  const tag = new Uint8Array(cipher.getAuthTag());

  return [
    WIRE_PREFIX,
    WIRE_VERSION,
    toBase64Url(ivBytes),
    toBase64Url(tag),
    toBase64Url(ciphertext),
  ].join(":");
}

export function decryptBootstrapPayload(
  wire: string,
  options?: { secret?: string; skipExpiryCheck?: boolean },
): IntrospectionBootstrapPayload {
  const parts = wire.split(":");

  if (parts.length !== 5 || parts[0] !== WIRE_PREFIX || parts[1] !== WIRE_VERSION) {
    throw new Error("Malformed introspection payload");
  }

  const [, , ivPart, tagPart, ctPart] = parts;
  const key = getSharedSecretKeyFromEnv(options?.secret);
  const iv = fromBase64Url(ivPart, "iv");
  const tag = fromBase64Url(tagPart, "tag");
  const ciphertext = fromBase64Url(ctPart, "ciphertext");

  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error("Invalid introspection IV length");
  }

  if (tag.length !== AES_GCM_TAG_BYTES) {
    throw new Error("Invalid introspection auth tag length");
  }

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);

  decipher.setAuthTag(tag);

  let plaintext: Uint8Array;

  try {
    plaintext = concatBytes([
      new Uint8Array(decipher.update(ciphertext)),
      new Uint8Array(decipher.final()),
    ]);
  } catch {
    throw new Error("Introspection payload authentication failed");
  }

  const json = JSON.parse(new TextDecoder().decode(plaintext));
  const parsed = IntrospectionBootstrapPayloadSchema.parse(json);

  if (!options?.skipExpiryCheck) {
    const now = Math.floor(Date.now() / 1000);

    if (parsed.exp < now) {
      throw new Error("Introspection payload expired");
    }
  }

  return parsed;
}

export function isIntrospectionPayloadWire(value: string): boolean {
  return value.startsWith(`${WIRE_PREFIX}:${WIRE_VERSION}:`);
}

export function assertIntrospectionSecretConfigured(secret?: string): void {
  getSharedSecretKeyFromEnv(secret);
}

export function buildTestBootstrapPayload(
  overrides: Partial<IntrospectionBootstrapPayload> &
    Pick<IntrospectionBootstrapPayload, "systemInstructions">,
): IntrospectionBootstrapPayload {
  const now = Math.floor(Date.now() / 1000);

  return IntrospectionBootstrapPayloadSchema.parse({
    v: 1,
    exp: now + 3600,
    nonce: randomBytes(16).toString("hex"),
    ...overrides,
  });
}

export function secretsEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);

  if (ab.length !== bb.length) return false;

  return timingSafeEqual(ab, bb);
}

/** @deprecated Use encryptBootstrapPayload */
export const encryptIntrospectionPayload = encryptBootstrapPayload;

/** @deprecated Use decryptBootstrapPayload */
export const decryptIntrospectionPayload = decryptBootstrapPayload;
