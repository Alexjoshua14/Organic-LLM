import { describe, expect, test } from "bun:test";

import {
  exportLastProviderStorageKey,
  readLastOpenInProvider,
  sortOpenInProvidersByLastUsed,
  writeLastOpenInProvider,
} from "@/lib/export/last-provider-storage";

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("export last-provider storage", () => {
  test("storage key is namespaced by preset id", () => {
    expect(exportLastProviderStorageKey("script-voiceover-chatgpt")).toBe(
      "organic-llm:export:lastProvider:script-voiceover-chatgpt",
    );
  });

  test("sortOpenInProvidersByLastUsed promotes stored provider", () => {
    const storage = createMemoryStorage({
      [exportLastProviderStorageKey("script-voiceover-chatgpt")]: "claude",
    });
    const sorted = sortOpenInProvidersByLastUsed(
      "script-voiceover-chatgpt",
      ["chatgpt", "claude"],
      storage,
    );
    expect(sorted).toEqual(["claude", "chatgpt"]);
  });

  test("writeLastOpenInProvider then readLastOpenInProvider round-trips", () => {
    const storage = createMemoryStorage();
    writeLastOpenInProvider("architecture-brief-chatgpt", "t3", storage);
    expect(readLastOpenInProvider("architecture-brief-chatgpt", storage)).toBe("t3");
  });
});
