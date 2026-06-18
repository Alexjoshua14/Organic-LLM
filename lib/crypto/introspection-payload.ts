import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

import {
  IntrospectionBootstrapPayloadSchema,
  type IntrospectionBootstrapPayload,
} from "@/lib/schemas/introspection";

const WIRE_PREFIX = "intro";
const WIRE_VERSION = "v1";
const AES_ALGORITHM = "aes-256-gcm";
const AES_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

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

function decodeSharedSecret(raw: string): Uint8Array {
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

function getSharedSecretKey(): Uint8Array {
  return decodeSharedSecret(process.env.INTROSPECTION_ORGANIC_SHARED_SECRET ?? "");
}

export function encryptIntrospectionPayload(payload: IntrospectionBootstrapPayload): string {
  const parsed = IntrospectionBootstrapPayloadSchema.parse(payload);
  const key = getSharedSecretKey();
  const ivBytes = new Uint8Array(randomBytes(AES_GCM_IV_BYTES));
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

export function decryptIntrospectionPayload(wire: string): IntrospectionBootstrapPayload {
  const parts = wire.split(":");

  if (parts.length !== 5 || parts[0] !== WIRE_PREFIX || parts[1] !== WIRE_VERSION) {
    throw new Error("Malformed introspection payload");
  }

  const [, , ivPart, tagPart, ctPart] = parts;
  const key = getSharedSecretKey();
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

  const now = Math.floor(Date.now() / 1000);

  if (parsed.exp < now) {
    throw new Error("Introspection payload expired");
  }

  return parsed;
}

/** Constant-time compare for optional wire validation without decrypt. */
export function isIntrospectionPayloadWire(value: string): boolean {
  return value.startsWith(`${WIRE_PREFIX}:${WIRE_VERSION}:`);
}

export function assertIntrospectionSecretConfigured(): void {
  getSharedSecretKey();
}

/** Test helper: generate a valid payload with default expiry. */
export function buildTestIntrospectionPayload(
  overrides: Partial<IntrospectionBootstrapPayload> & Pick<IntrospectionBootstrapPayload, "systemInstructions">
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
