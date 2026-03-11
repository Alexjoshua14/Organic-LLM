import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

describe("message encryption service", () => {
  let cryptoModule: typeof import("@/lib/crypto/message-encryption");

  beforeEach(async () => {
    cryptoModule = await import("@/lib/crypto/message-encryption");
  });

  test("encrypts and decrypts a payload round trip", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });
    const context = {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "messages.content" as const,
    };

    const encrypted = service.encryptForStorage("hello world", context);
    const parsed = cryptoModule.parseEncryptedPayload(encrypted);

    expect(encrypted.startsWith("enc:v1:k1:")).toBe(true);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe("v1");
    expect(parsed?.keyId).toBe("k1");
    expect(service.decryptFromStorage(encrypted, context)).toBe("hello world");
  });

  test("returns legacy plaintext unchanged", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });

    expect(
      service.decryptFromStorage("legacy plaintext", {
        userId: "user-1",
        threadId: "thread-1",
        fieldName: "messages.content",
      }),
    ).toBe("legacy plaintext");
  });

  test("rejects malformed encrypted payloads", () => {
    expect(() =>
      cryptoModule.parseEncryptedPayload("enc:v1:k1:not-valid"),
    ).toThrow("Malformed encrypted payload");
  });

  test("fails decryption when user AAD does not match", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });

    const encrypted = service.encryptForStorage("secret", {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "messages.content",
    });

    expect(() =>
      service.decryptFromStorage(encrypted, {
        userId: "user-2",
        threadId: "thread-1",
        fieldName: "messages.content",
      }),
    ).toThrow();
  });

  test("fails decryption when thread AAD does not match", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });

    const encrypted = service.encryptForStorage("secret", {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "messages.content",
    });

    expect(() =>
      service.decryptFromStorage(encrypted, {
        userId: "user-1",
        threadId: "thread-2",
        fieldName: "messages.content",
      }),
    ).toThrow();
  });

  test("fails decryption when field-name AAD does not match", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });

    const encrypted = service.encryptForStorage("secret", {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "thread_summaries.summary_text",
    });

    expect(() =>
      service.decryptFromStorage(encrypted, {
        userId: "user-1",
        threadId: "thread-1",
        fieldName: "threads.conversation_summary",
      }),
    ).toThrow();
  });

  test("supports mixed key ids in the same thread", () => {
    const serviceUsingK1 = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: {
        k1: "root-secret-one",
        k2: "root-secret-two",
      },
    });
    const serviceUsingK2 = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k2",
      keyRegistry: {
        k1: "root-secret-one",
        k2: "root-secret-two",
      },
    });
    const context = {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "messages.content" as const,
    };

    const encryptedWithK1 = serviceUsingK1.encryptForStorage(
      "first payload",
      context,
    );
    const encryptedWithK2 = serviceUsingK2.encryptForStorage(
      "second payload",
      context,
    );

    expect(serviceUsingK2.decryptFromStorage(encryptedWithK1, context)).toBe(
      "first payload",
    );
    expect(serviceUsingK2.decryptFromStorage(encryptedWithK2, context)).toBe(
      "second payload",
    );
  });

  test("throws when a payload references an unknown key id", () => {
    const serviceUsingK1 = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });
    const serviceUsingK2Only = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k2",
      keyRegistry: { k2: "root-secret-two" },
    });
    const context = {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "messages.content" as const,
    };

    const encrypted = serviceUsingK1.encryptForStorage("secret", context);

    expect(() => serviceUsingK2Only.decryptFromStorage(encrypted, context)).toThrow(
      "Unknown message encryption key id: k1",
    );
  });

  test("derives different user keys for different users", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });

    const userOneKey = service.deriveUserKey("user-1");
    const userTwoKey = service.deriveUserKey("user-2");

    expect(Buffer.compare(userOneKey, userTwoKey)).not.toBe(0);
  });

  test("round trips very large message payloads", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });
    const largePayload = JSON.stringify({
      id: "msg-large",
      role: "assistant",
      parts: Array.from({ length: 200 }).map((_, index) => ({
        type: "text",
        text: `chunk-${index}:${"x".repeat(4096)}`,
      })),
    });
    const context = {
      userId: "user-1",
      threadId: "thread-1",
      fieldName: "messages.content" as const,
    };

    const encrypted = service.encryptForStorage(largePayload, context);
    const decrypted = service.decryptFromStorage(encrypted, context);

    expect(decrypted).toBe(largePayload);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(largePayload));
  });

  test("preserves large legacy plaintext rows", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });
    const legacyPayload = JSON.stringify({
      id: "msg-legacy",
      role: "assistant",
      parts: [{ type: "text", text: "y".repeat(64_000) }],
    });

    expect(
      service.decryptFromStorage(legacyPayload, {
        userId: "user-1",
        threadId: "thread-1",
        fieldName: "messages.content",
      }),
    ).toBe(legacyPayload);
  });

  test("performance smoke test covers expected read and write volume", () => {
    const service = cryptoModule.createMessageEncryptionService({
      activeKeyId: "k1",
      keyRegistry: { k1: "root-secret-one" },
    });
    const payload = JSON.stringify({
      id: "msg-perf",
      role: "assistant",
      parts: [{ type: "text", text: "z".repeat(4096) }],
    });

    const contexts = Array.from({ length: 120 }).map((_, index) => ({
      userId: "user-1",
      threadId: `thread-${index % 8}`,
      fieldName: "messages.content" as const,
    }));

    const start = performance.now();
    const encrypted = contexts.map((context) =>
      service.encryptForStorage(payload, context),
    );
    const encryptedElapsedMs = performance.now() - start;

    const decryptStart = performance.now();
    const decrypted = encrypted.map((value, index) =>
      service.decryptFromStorage(value, contexts[index]),
    );
    const decryptedElapsedMs = performance.now() - decryptStart;

    expect(decrypted).toHaveLength(120);
    expect(decrypted.every((value) => value === payload)).toBe(true);
    expect(encryptedElapsedMs).toBeLessThan(5_000);
    expect(decryptedElapsedMs).toBeLessThan(5_000);
  });
});
