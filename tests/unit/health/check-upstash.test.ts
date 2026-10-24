import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@/lib/redis/redis", () => ({
  redis: {
    ping: mock(() => Promise.resolve("PONG")),
  },
}));

import { checkUpstash } from "@/lib/health/checks/upstash";

describe("checkUpstash", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  });

  test("returns skipped when not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = await checkUpstash();
    expect(result.status).toBe("skipped");
    expect(result.summary).toBe("Not configured");
  });

  test("returns ok when ping returns PONG", async () => {
    const result = await checkUpstash();
    expect(result.status).toBe("ok");
    expect(result.summary).toBe("Reachable");
  });
});
