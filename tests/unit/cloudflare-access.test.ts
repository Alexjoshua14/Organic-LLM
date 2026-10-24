import { afterEach, describe, expect, test } from "bun:test";

import {
  cloudflareAccessHeaders,
  isCloudflareAccessConfigured,
} from "@/lib/cloudflare-access";

const ENV_KEYS = [
  "MEMORY_CF_ACCESS_CLIENT_ID",
  "MEMORY_CF_ACCESS_CLIENT_SECRET",
  "OLLAMA_CF_ACCESS_CLIENT_ID",
  "OLLAMA_CF_ACCESS_CLIENT_SECRET",
] as const;

describe("cloudflareAccessHeaders", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  test("is empty when nothing is configured", () => {
    expect(cloudflareAccessHeaders("memory")).toEqual({});
    expect(isCloudflareAccessConfigured("memory")).toBe(false);
  });

  test("sends both headers when the full token is set", () => {
    process.env.MEMORY_CF_ACCESS_CLIENT_ID = "id.access";
    process.env.MEMORY_CF_ACCESS_CLIENT_SECRET = "secret";

    expect(cloudflareAccessHeaders("memory")).toEqual({
      "CF-Access-Client-Id": "id.access",
      "CF-Access-Client-Secret": "secret",
    });
    expect(isCloudflareAccessConfigured("memory")).toBe(true);
  });

  test("never sends a lone half of the token", () => {
    process.env.OLLAMA_CF_ACCESS_CLIENT_ID = "id.access";

    expect(cloudflareAccessHeaders("ollama")).toEqual({});
    expect(isCloudflareAccessConfigured("ollama")).toBe(false);
  });

  test("keeps each service's token separate", () => {
    process.env.MEMORY_CF_ACCESS_CLIENT_ID = "memory-id";
    process.env.MEMORY_CF_ACCESS_CLIENT_SECRET = "memory-secret";

    expect(cloudflareAccessHeaders("ollama")).toEqual({});
  });

  test("treats whitespace-only values as unset", () => {
    process.env.MEMORY_CF_ACCESS_CLIENT_ID = "  ";
    process.env.MEMORY_CF_ACCESS_CLIENT_SECRET = "secret";

    expect(cloudflareAccessHeaders("memory")).toEqual({});
  });
});
