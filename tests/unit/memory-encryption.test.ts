import { beforeEach, describe, expect, test } from "bun:test";

/** Base64 of 32 bytes (deterministic test IKM k1; not for production). */
const TEST_MEMORY_KEY_K1 = "QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=";

/** Base64 of 32 bytes (different IKM for k2). */
const TEST_MEMORY_KEY_K2 = "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=";

function applyDefaultMemoryKeyEnv() {
  process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k1";
  process.env.MEMORY_ENCRYPTION_KEY_K1 = TEST_MEMORY_KEY_K1;
  process.env.MEMORY_ENCRYPTION_KEY_K2 = TEST_MEMORY_KEY_K2;
}

describe("memory encryption", () => {
  let mod: typeof import("@/lib/crypto/memory-encryption");

  beforeEach(async () => {
    applyDefaultMemoryKeyEnv();
    mod = await import("@/lib/crypto/memory-encryption");
    mod.resetMemoryEncryptionKeyCache();
  });

  test("round-trip: empty string", () => {
    const plain = "";
    const enc = mod.encryptMemory(plain);
    expect(mod.isEncrypted(enc)).toBe(true);
    expect(mod.decryptMemory(enc)).toBe(plain);
  });

  test("round-trip: unicode including emoji and supplemental plane", () => {
    const plain = "Hello 世界 🌍\nline2\t\u0000null\u{1f4a9}\u{10000}supplementary";
    const enc = mod.encryptMemory(plain);
    expect(mod.decryptMemory(enc)).toBe(plain);
  });

  test("round-trip: very long string", () => {
    const plain = "x".repeat(75_000);
    const enc = mod.encryptMemory(plain);
    expect(mod.decryptMemory(enc)).toBe(plain);
  });

  test("round-trip: binary-looking string (all byte values as latin1)", () => {
    const bytes = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const plain = bytes.toString("latin1");
    const enc = mod.encryptMemory(plain);
    expect(mod.decryptMemory(enc)).toBe(plain);
  });

  test("isEncrypted is false for normal text, old four-segment format, and message-style enc prefix", () => {
    expect(mod.isEncrypted("hello")).toBe(false);
    expect(mod.isEncrypted("enc:v1:k1:iv:tag:ct")).toBe(false);
    expect(mod.isEncrypted("v1:short")).toBe(false);
    expect(mod.isEncrypted("v1:ivB64:tagB64:ctB64")).toBe(false);
  });

  test("tampered ciphertext fails decryption with friendly error and cause", () => {
    const enc = mod.encryptMemory("secret-payload");
    const parts = enc.split(":");
    const ct = Buffer.from(parts[4], "base64");
    ct[0] ^= 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${ct.toString("base64")}`;

    expect(() => mod.decryptMemory(tampered)).toThrow(
      /Memory decryption failed: ciphertext may have been tampered with or the key is wrong/,
    );

    try {
      mod.decryptMemory(tampered);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).cause).toBeDefined();
    }
  });

  test("malformed payload throws before generic decrypt wrapper", () => {
    expect(() => mod.decryptMemory("not-v1-at-all")).toThrow("Malformed memory encrypted payload");
  });

  test("invalid base64 in iv throws with clear label", () => {
    const enc = mod.encryptMemory("x");
    const parts = enc.split(":");
    parts[2] = parts[2].replace(/[A-Z]/, "@");
    expect(() => mod.decryptMemory(parts.join(":"))).toThrow("Invalid iv encoding");
  });
});

describe("memory encryption key rotation", () => {
  let mod: typeof import("@/lib/crypto/memory-encryption");

  beforeEach(async () => {
    applyDefaultMemoryKeyEnv();
    mod = await import("@/lib/crypto/memory-encryption");
    mod.resetMemoryEncryptionKeyCache();
  });

  test("uses the current key version for new encryption", () => {
    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k1";
    mod.resetMemoryEncryptionKeyCache();
    const enc = mod.encryptMemory("hello");
    expect(enc).toMatch(/^v1:k1:/);
  });

  test("decrypts data with non-current key version", () => {
    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k1";
    mod.resetMemoryEncryptionKeyCache();
    const encWithK1 = mod.encryptMemory("hello");

    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k2";
    mod.resetMemoryEncryptionKeyCache();

    expect(mod.decryptMemory(encWithK1)).toBe("hello");
  });

  test("throws MemoryKeyNotFoundError when key is missing", () => {
    const enc = mod.encryptMemory("hello");
    const parts = enc.split(":");
    parts[1] = "k99";
    const claimsK99 = parts.join(":");

    expect(() => mod.decryptMemory(claimsK99)).toThrow(mod.MemoryKeyNotFoundError);
  });

  test("reencryptMemory upgrades to current key", () => {
    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k1";
    mod.resetMemoryEncryptionKeyCache();
    const old = mod.encryptMemory("hello");

    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k2";
    mod.resetMemoryEncryptionKeyCache();
    const upgraded = mod.reencryptMemory(old);

    expect(upgraded).toMatch(/^v1:k2:/);
    expect(mod.decryptMemory(upgraded)).toBe("hello");
  });

  test("isEncryptedWithCurrentKey detects mismatch", () => {
    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k1";
    mod.resetMemoryEncryptionKeyCache();
    const k1Encrypted = mod.encryptMemory("hello");

    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k2";
    mod.resetMemoryEncryptionKeyCache();
    expect(mod.isEncryptedWithCurrentKey(k1Encrypted)).toBe(false);
  });
});

describe("MEMORY_ENCRYPTION_CURRENT_KEY validation", () => {
  let mod: typeof import("@/lib/crypto/memory-encryption");

  beforeEach(async () => {
    process.env.MEMORY_ENCRYPTION_KEY_K1 = TEST_MEMORY_KEY_K1;
    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "not-a-version";
    mod = await import("@/lib/crypto/memory-encryption");
    mod.resetMemoryEncryptionKeyCache();
  });

  test("encryptMemory throws when current key id is invalid", () => {
    expect(() => mod.encryptMemory("x")).toThrow(
      "MEMORY_ENCRYPTION_CURRENT_KEY must be of form 'k<number>' (e.g., 'k1'); got: not-a-version",
    );
  });
});

describe("missing MEMORY_ENCRYPTION_CURRENT_KEY", () => {
  let mod: typeof import("@/lib/crypto/memory-encryption");

  beforeEach(async () => {
    process.env.MEMORY_ENCRYPTION_KEY_K1 = TEST_MEMORY_KEY_K1;
    delete process.env.MEMORY_ENCRYPTION_CURRENT_KEY;
    mod = await import("@/lib/crypto/memory-encryption");
    mod.resetMemoryEncryptionKeyCache();
  });

  test("encryptMemory throws when current key is missing", () => {
    expect(() => mod.encryptMemory("x")).toThrow("Missing MEMORY_ENCRYPTION_CURRENT_KEY");
  });
});

describe("isEncryptedWithCurrentKey edge cases", () => {
  let mod: typeof import("@/lib/crypto/memory-encryption");

  beforeEach(async () => {
    applyDefaultMemoryKeyEnv();
    mod = await import("@/lib/crypto/memory-encryption");
    mod.resetMemoryEncryptionKeyCache();
  });

  test("returns false for garbage", () => {
    expect(mod.isEncryptedWithCurrentKey("not-ciphertext")).toBe(false);
  });
});
