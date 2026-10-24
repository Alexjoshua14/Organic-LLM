import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { resolveMemoryApiEnv } from "@/lib/memory/qdrant-config";

const ENV_KEYS = ["MEMORY_API_HOST", "MEMORY_API_PORT", "MEMORY_API_SECRET"] as const;

describe("resolveMemoryApiEnv", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  test("defaults to localhost on port 6333 without https", () => {
    const env = resolveMemoryApiEnv();

    expect(env.host).toBe("localhost");
    expect(env.port).toBe(6333);
    expect(env.https).toBe(false);
  });

  test("remote host without explicit port uses 443 over https", () => {
    process.env.MEMORY_API_HOST = "memory.example.com";

    const env = resolveMemoryApiEnv();

    expect(env.host).toBe("memory.example.com");
    expect(env.port).toBe(443);
    expect(env.https).toBe(true);
  });

  test("explicit MEMORY_API_PORT overrides the default", () => {
    process.env.MEMORY_API_HOST = "memory.example.com";
    process.env.MEMORY_API_PORT = "6334";

    expect(resolveMemoryApiEnv().port).toBe(6334);
  });

  test("invalid MEMORY_API_PORT falls back without throwing", () => {
    process.env.MEMORY_API_HOST = "memory.example.com";
    process.env.MEMORY_API_PORT = "not-a-port";

    expect(() => resolveMemoryApiEnv()).not.toThrow();
    expect(resolveMemoryApiEnv().port).toBe(443);
  });

  test("passes MEMORY_API_SECRET through as apiKey", () => {
    process.env.MEMORY_API_SECRET = "secret-value";

    expect(resolveMemoryApiEnv().apiKey).toBe("secret-value");
  });
});
