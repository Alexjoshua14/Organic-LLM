import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const context = (userId: string, revision: number) => ({ userId, threadId: `stage:${revision}`, fieldName: "stage.events" as const });

describe("stage encrypted snapshots", () => {
  test("binds a full event to its owner and revision", async () => {
    const { createMessageEncryptionService } = await import("@/lib/crypto/message-encryption");
    const service = createMessageEncryptionService({ activeKeyId: "k1", keyRegistry: { k1: "test-root-key" } });
    const event = JSON.stringify({ revision: 3, bundle: { summary: "private" } });
    const encrypted = service.encryptForStorage(event, context("owner-1", 3));
    expect(encrypted).not.toContain("private");
    expect(service.decryptFromStorage(encrypted, context("owner-1", 3))).toBe(event);
    expect(() => service.decryptFromStorage(encrypted, context("owner-2", 3))).toThrow();
    expect(() => service.decryptFromStorage(encrypted, context("owner-1", 4))).toThrow();
  });
});
