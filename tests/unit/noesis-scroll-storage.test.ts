import { describe, expect, test } from "bun:test";

import {
  loadNoesisScrollSnapshot,
  noesisConversationInitial,
  noesisScrollStorageKey,
  parseNoesisScrollSnapshot,
  saveNoesisScrollSnapshot,
} from "@/lib/sandbox/noesis-scroll-storage";

describe("noesis scroll storage", () => {
  test("noesisScrollStorageKey is thread-scoped", () => {
    expect(noesisScrollStorageKey("abc")).toBe("organic-llm-noesis-scroll:abc");
  });

  test("parseNoesisScrollSnapshot validates shape and expiry", () => {
    expect(parseNoesisScrollSnapshot(null)).toBeNull();
    expect(parseNoesisScrollSnapshot("{")).toBeNull();
    expect(
      parseNoesisScrollSnapshot(
        JSON.stringify({ scrollTop: -4, isAtBottom: true, savedAt: Date.now() })
      )
    ).toEqual({
      scrollTop: 0,
      isAtBottom: true,
      savedAt: expect.any(Number),
    });
    expect(
      parseNoesisScrollSnapshot(
        JSON.stringify({ scrollTop: 120, isAtBottom: false, savedAt: Date.now() - 31 * 86400000 })
      )
    ).toBeNull();
  });

  test("noesisConversationInitial disables stick when restoring mid-thread", () => {
    expect(noesisConversationInitial(null)).toBe("instant");
    expect(
      noesisConversationInitial({ scrollTop: 0, isAtBottom: true, savedAt: Date.now() })
    ).toBe("instant");
    expect(
      noesisConversationInitial({ scrollTop: 240, isAtBottom: false, savedAt: Date.now() })
    ).toBe(false);
  });

  test("save and load round-trip with localStorage", () => {
    const store = new Map<string, string>();
    const original = globalThis.localStorage;

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });

    try {
      saveNoesisScrollSnapshot("thread-1", { scrollTop: 512, isAtBottom: false });
      expect(loadNoesisScrollSnapshot("thread-1")).toEqual({
        scrollTop: 512,
        isAtBottom: false,
        savedAt: expect.any(Number),
      });
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          value: original,
        });
      } else {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      }
    }
  });
});
