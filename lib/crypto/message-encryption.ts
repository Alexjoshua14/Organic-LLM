import "server-only";

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ENCRYPTED_PREFIX = "enc";
const PAYLOAD_VERSION = "v1";
const AES_ALGORITHM = "aes-256-gcm";
const AES_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const DEFAULT_ACTIVE_KEY_ID = "k1";
const DEFAULT_HKDF_SALT = "organic-llm-message-encryption";
const DEFAULT_HKDF_INFO_PREFIX = "organic-llm-user-encryption";

export type EncryptionFieldName =
  | "messages.content"
  | "thread_summaries.summary_text"
  | "threads.conversation_summary"
  | "strata_sections.raw_text"
  | "strata_sections.refined_text"
  | "strata_sections.elaborated"
  | "strata_sections.design_instructions"
  | "strata_sections.ai_instructions";

export type EncryptionContext = {
  userId: string;
  threadId: string;
  fieldName: EncryptionFieldName;
};

export type ParsedEncryptedPayload = {
  version: typeof PAYLOAD_VERSION;
  keyId: string;
  iv: Uint8Array;
  tag: Uint8Array;
  ciphertext: Uint8Array;
};

type KeyRegistryInput = Record<string, string | Uint8Array>;

type MessageEncryptionServiceConfig = {
  activeKeyId: string;
  keyRegistry: KeyRegistryInput;
  hkdfSalt?: string | Uint8Array;
  hkdfInfoPrefix?: string;
};

export type MessageEncryptionService = ReturnType<typeof createMessageEncryptionService>;

function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new Uint8Array(Buffer.from(value, "utf8")) : value;
}

function decodeBase64(value: string, label: string): Uint8Array {
  try {
    return new Uint8Array(Buffer.from(value, "base64"));
  } catch {
    throw new Error(`Invalid ${label} encoding`);
  }
}

function normalizeRegistry(input: KeyRegistryInput): Record<string, Uint8Array> {
  const entries = Object.entries(input);

  if (entries.length === 0) {
    throw new Error("Message encryption key registry must not be empty");
  }

  return Object.fromEntries(
    entries.map(([keyId, secret]) => {
      if (keyId.trim().length === 0) {
        throw new Error("Message encryption key ids must not be empty");
      }

      const buffer = toBytes(secret);

      if (buffer.length === 0) {
        throw new Error(`Message encryption secret for ${keyId} is empty`);
      }

      return [keyId, buffer];
    })
  );
}

function serializeEncryptedPayload({
  keyId,
  iv,
  tag,
  ciphertext,
}: Omit<ParsedEncryptedPayload, "version">): string {
  return [
    ENCRYPTED_PREFIX,
    PAYLOAD_VERSION,
    keyId,
    Buffer.from(iv).toString("base64"),
    Buffer.from(tag).toString("base64"),
    Buffer.from(ciphertext).toString("base64"),
  ].join(":");
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

export function buildAad(context: EncryptionContext): Uint8Array {
  return new Uint8Array(
    Buffer.from(`${context.userId}:${context.threadId}:${context.fieldName}`, "utf8")
  );
}

export function parseEncryptedPayload(value: string): ParsedEncryptedPayload | null {
  if (!value.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    return null;
  }

  const parts = value.split(":");

  if (parts.length !== 6) {
    throw new Error("Malformed encrypted payload");
  }

  const [prefix, version, keyId, ivB64, tagB64, ciphertextB64] = parts;

  if (prefix !== ENCRYPTED_PREFIX) {
    throw new Error("Invalid encrypted payload prefix");
  }

  if (version !== PAYLOAD_VERSION) {
    throw new Error(`Unsupported encrypted payload version: ${version}`);
  }

  if (keyId.trim().length === 0) {
    throw new Error("Encrypted payload key id is empty");
  }

  const iv = decodeBase64(ivB64, "iv");
  const tag = decodeBase64(tagB64, "auth tag");
  const ciphertext = decodeBase64(ciphertextB64, "ciphertext");

  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error("Encrypted payload iv has invalid length");
  }

  if (tag.length !== AES_GCM_TAG_BYTES) {
    throw new Error("Encrypted payload auth tag has invalid length");
  }

  return {
    version: PAYLOAD_VERSION,
    keyId,
    iv,
    tag,
    ciphertext,
  };
}

function buildDefaultService(): MessageEncryptionService {
  const rootSecret = process.env.ORGANIC_LLM_ROOT_SECRET;

  if (!rootSecret) {
    throw new Error("Missing ORGANIC_LLM_ROOT_SECRET");
  }

  const activeKeyId = process.env.ORGANIC_LLM_ACTIVE_KEY_ID ?? DEFAULT_ACTIVE_KEY_ID;

  let parsedRegistry: KeyRegistryInput = {};
  const rawRegistry = process.env.ORGANIC_LLM_KEY_REGISTRY_JSON;

  if (rawRegistry) {
    try {
      const parsed = JSON.parse(rawRegistry);

      if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Key registry JSON must be an object");
      }
      parsedRegistry = parsed as Record<string, string>;
    } catch (error) {
      throw new Error(
        `Invalid ORGANIC_LLM_KEY_REGISTRY_JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return createMessageEncryptionService({
    activeKeyId,
    keyRegistry: {
      ...parsedRegistry,
      [activeKeyId]: rootSecret,
    },
  });
}

const defaultServiceCache: {
  current: MessageEncryptionService | null;
} = { current: null };

export function getMessageEncryptionService(): MessageEncryptionService {
  if (defaultServiceCache.current === null) {
    defaultServiceCache.current = buildDefaultService();
  }

  return defaultServiceCache.current;
}

export function createMessageEncryptionService(config: MessageEncryptionServiceConfig) {
  if (config.activeKeyId.trim().length === 0) {
    throw new Error("Message encryption active key id must not be empty");
  }

  const keyRegistry = normalizeRegistry(config.keyRegistry);

  if (!(config.activeKeyId in keyRegistry)) {
    throw new Error(
      `Active message encryption key id is missing from registry: ${config.activeKeyId}`
    );
  }

  const hkdfSalt = toBytes(config.hkdfSalt ?? DEFAULT_HKDF_SALT);
  const hkdfInfoPrefix = config.hkdfInfoPrefix?.trim() || DEFAULT_HKDF_INFO_PREFIX;

  function deriveUserKey(userId: string, keyId: string = config.activeKeyId) {
    if (userId.trim().length === 0) {
      throw new Error("Message encryption user id must not be empty");
    }

    const rootSecret = keyRegistry[keyId];

    if (!rootSecret) {
      throw new Error(`Unknown message encryption key id: ${keyId}`);
    }

    return new Uint8Array(
      hkdfSync(
        "sha256",
        rootSecret,
        hkdfSalt,
        new Uint8Array(Buffer.from(`${hkdfInfoPrefix}:${userId}`, "utf8")),
        AES_KEY_BYTES
      )
    );
  }

  function encryptForStorage(plaintext: string, context: EncryptionContext) {
    const key = deriveUserKey(context.userId, config.activeKeyId);
    const iv = new Uint8Array(randomBytes(AES_GCM_IV_BYTES));
    const cipher = createCipheriv(AES_ALGORITHM, key, iv);

    cipher.setAAD(buildAad(context));

    const ciphertext = concatBytes([
      new Uint8Array(cipher.update(plaintext, "utf8")),
      new Uint8Array(cipher.final()),
    ]);
    const tag = new Uint8Array(cipher.getAuthTag());

    return serializeEncryptedPayload({
      keyId: config.activeKeyId,
      iv,
      tag,
      ciphertext,
    });
  }

  function decryptFromStorage(value: string, context: EncryptionContext) {
    const payload = parseEncryptedPayload(value);

    if (payload === null) {
      return value;
    }

    const key = deriveUserKey(context.userId, payload.keyId);
    const decipher = createDecipheriv(AES_ALGORITHM, key, payload.iv);

    decipher.setAAD(buildAad(context));
    decipher.setAuthTag(payload.tag);

    return Buffer.from(
      concatBytes([
        new Uint8Array(decipher.update(payload.ciphertext)),
        new Uint8Array(decipher.final()),
      ])
    ).toString("utf8");
  }

  return {
    activeKeyId: config.activeKeyId,
    keyRegistry,
    deriveUserKey,
    encryptForStorage,
    decryptFromStorage,
    isEncryptedPayload(value: string) {
      return value.startsWith(`${ENCRYPTED_PREFIX}:`);
    },
    parseEncryptedPayload,
  };
}

export function encryptForStorage(plaintext: string, context: EncryptionContext): string {
  return getMessageEncryptionService().encryptForStorage(plaintext, context);
}

export function decryptFromStorage(value: string, context: EncryptionContext): string {
  return getMessageEncryptionService().decryptFromStorage(value, context);
}

export function isEncryptedPayload(value: string): boolean {
  return getMessageEncryptionService().isEncryptedPayload(value);
}

export function deriveUserKey(userId: string, keyId?: string): Uint8Array {
  return getMessageEncryptionService().deriveUserKey(userId, keyId);
}
