import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearDeviceRootKey,
  resetComposerDeviceKeyForTests,
} from "@/lib/crypto/composer-device-key";
import {
  clearAllComposerDrafts,
  clearDraft,
  loadDraft,
  resetComposerDraftStoreForTests,
  saveDraft,
} from "@/lib/chat/composer-draft-store";

const CHAT_A = "550e8400-e29b-41d4-a716-446655440000";
const CHAT_B = "660e8400-e29b-41d4-a716-446655440001";
const USER_A = "user_clerk_a";

describe("composer-draft-store", () => {
  beforeEach(async () => {
    resetComposerDeviceKeyForTests();
    resetComposerDraftStoreForTests();
    await clearDeviceRootKey();
    await clearAllComposerDrafts();
  });

  afterEach(async () => {
    resetComposerDeviceKeyForTests();
    resetComposerDraftStoreForTests();
    await clearDeviceRootKey();
    await clearAllComposerDrafts();
  });

  test("saveDraft and loadDraft round-trip encrypted text", async () => {
    const text = "Draft for thread A";

    await saveDraft(CHAT_A, text, USER_A);

    const loaded = await loadDraft(CHAT_A, USER_A);

    expect(loaded).toBe(text);
  });

  test("clearDraft removes stored draft", async () => {
    await saveDraft(CHAT_A, "temporary", USER_A);
    await clearDraft(CHAT_A);

    const loaded = await loadDraft(CHAT_A, USER_A);

    expect(loaded).toBeNull();
  });

  test("empty text clears draft on save", async () => {
    await saveDraft(CHAT_A, "to be cleared", USER_A);
    await saveDraft(CHAT_A, "   ", USER_A);

    const loaded = await loadDraft(CHAT_A, USER_A);

    expect(loaded).toBeNull();
  });

  test("different chatIds store independent drafts", async () => {
    await saveDraft(CHAT_A, "draft A", USER_A);
    await saveDraft(CHAT_B, "draft B", USER_A);

    expect(await loadDraft(CHAT_A, USER_A)).toBe("draft A");
    expect(await loadDraft(CHAT_B, USER_A)).toBe("draft B");
  });
});
