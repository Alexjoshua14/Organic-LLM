import { describe, expect, test } from "bun:test";

import {
  chunkMemoryText,
  isMemoryEncryptionEnvConfigured,
  v2ChunkPointId,
} from "@/lib/memory/migrate-memories-v2-helpers";

describe("v2ChunkPointId", () => {
  test("builds stable UUID v5 ids", () => {
    expect(v2ChunkPointId("abc-123", 0)).toBe("bdfed70e-ebe6-5bcd-a6e5-a303bd3405c0");
    expect(v2ChunkPointId("abc-123", 3)).toBe("1fc66ab6-68e8-5820-870c-8839a317bcfc");
  });
});

describe("chunkMemoryText", () => {
  test("returns single chunk for short text", () => {
    expect(chunkMemoryText("hello", 1000, 50)).toEqual(["hello"]);
  });

  test("splits long text", () => {
    const long = "a".repeat(2500);
    const maxChunkChars = 1200;
    const chunks = chunkMemoryText(long, maxChunkChars, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(maxChunkChars);
    }
  });

  test("empty input yields empty array", () => {
    expect(chunkMemoryText("   ", 100, 10)).toEqual([]);
  });
});

describe("isMemoryEncryptionEnvConfigured", () => {
  test("false when env unset", () => {
    const prevCurrent = process.env.MEMORY_ENCRYPTION_CURRENT_KEY;
    const prevK1 = process.env.MEMORY_ENCRYPTION_KEY_K1;
    delete process.env.MEMORY_ENCRYPTION_CURRENT_KEY;
    delete process.env.MEMORY_ENCRYPTION_KEY_K1;
    expect(isMemoryEncryptionEnvConfigured()).toBe(false);
    process.env.MEMORY_ENCRYPTION_CURRENT_KEY = prevCurrent;
    process.env.MEMORY_ENCRYPTION_KEY_K1 = prevK1;
  });
});
