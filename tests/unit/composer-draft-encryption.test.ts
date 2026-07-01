import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearDeviceRootKey,
  getOrCreateDeviceRootKey,
  resetComposerDeviceKeyForTests,
} from "@/lib/crypto/composer-device-key";
import {
  decryptComposerDraft,
  encryptComposerDraft,
} from "@/lib/crypto/composer-draft-encryption";

const CHAT_A = "550e8400-e29b-41d4-a716-446655440000";
const CHAT_B = "660e8400-e29b-41d4-a716-446655440001";
const USER_A = "user_clerk_a";

describe("composer-draft-encryption", () => {
  beforeEach(async () => {
    resetComposerDeviceKeyForTests();
    await clearDeviceRootKey();
  });

  afterEach(async () => {
    resetComposerDeviceKeyForTests();
    await clearDeviceRootKey();
  });

  test("round-trips plaintext with per-chat context", async () => {
    const plaintext = "Remember to follow up on the Lisbon flights.";

    const payload = await encryptComposerDraft(plaintext, {
      chatId: CHAT_A,
      userId: USER_A,
    });

    expect(payload.startsWith("enc:v1:")).toBe(true);

    const decrypted = await decryptComposerDraft(payload, {
      chatId: CHAT_A,
      userId: USER_A,
    });

    expect(decrypted).toBe(plaintext);
  });

  test("wrong chatId fails decrypt gracefully", async () => {
    const payload = await encryptComposerDraft("secret draft", {
      chatId: CHAT_A,
      userId: USER_A,
    });

    const decrypted = await decryptComposerDraft(payload, {
      chatId: CHAT_B,
      userId: USER_A,
    });

    expect(decrypted).toBeNull();
  });

  test("tampered ciphertext fails decrypt gracefully", async () => {
    const payload = await encryptComposerDraft("secret draft", {
      chatId: CHAT_A,
      userId: USER_A,
    });

    const tampered = payload.replace(/.$/, payload.endsWith("A") ? "B" : "A");
    const decrypted = await decryptComposerDraft(tampered, {
      chatId: CHAT_A,
      userId: USER_A,
    });

    expect(decrypted).toBeNull();
  });

  test("device root key is non-extractable", async () => {
    const rootKey = await getOrCreateDeviceRootKey();

    await expect(crypto.subtle.exportKey("raw", rootKey)).rejects.toThrow();
  });
});
