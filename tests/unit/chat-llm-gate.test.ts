import { describe, expect, mock, test } from "bun:test";

import { ProfileNotFoundError } from "@/data/supabase/profiles";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";

type Deps = NonNullable<Parameters<typeof requireLlmChatActor>[1]>;
function dependencies(): Deps {
  return {
    userId: async () => "clerk-owner",
    profile: async () => ({ data: "owner", error: null }),
    messageLimit: async () => ({ success: true }),
    activeStreams: async () => 0,
    budget: mock(async () => {
      throw new Error("Unexpected budget call");
    }),
  };
}

describe("chat auth gate failure responses", () => {
  test("absent identity returns 401 before accessing a profile", async () => {
    const deps = dependencies();
    deps.userId = async () => null;
    const profile = mock(deps.profile);
    deps.profile = profile;
    const result = await requireLlmChatActor({ planBudget: false }, deps);

    expect(result.error?.status).toBe(401);
    expect(profile).not.toHaveBeenCalled();
  });

  test("missing profile is 404, failed profile lookup is retryable 503", async () => {
    const deps = dependencies();
    deps.profile = async () => ({ data: null, error: new ProfileNotFoundError() });
    expect((await requireLlmChatActor({}, deps)).error?.status).toBe(404);
    deps.profile = async () => ({ data: null, error: new Error("private database details") });
    const response = (await requireLlmChatActor({}, deps)).error!;

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(await response.json()).toMatchObject({ code: "profile_unavailable" });
  });

  for (const [dependency, stage] of [
    ["userId", "auth"],
    ["messageLimit", "rate_limit"],
    ["activeStreams", "stream_capacity"],
    ["budget", "plan"],
  ] as const) {
    test(`${dependency} exceptions return a sanitized 503`, async () => {
      const deps = dependencies();
      deps[dependency] = async () => {
        throw new Error("private provider details");
      };
      const response = (await requireLlmChatActor({}, deps)).error!;

      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Retry-After")).toBe("30");
      const body = await response.json();
      expect(body.code).toBe(`${stage}_unavailable`);
      expect(JSON.stringify(body)).not.toContain("private provider details");
    });
  }

  test("quota denial retains reset timing for Retry-After", async () => {
    const deps = dependencies();
    deps.messageLimit = async () => ({ success: false, reset: Date.now() + 60_000 });
    const response = (await requireLlmChatActor({}, deps)).error!;

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(59);
    expect(Number(response.headers.get("Retry-After"))).toBeLessThanOrEqual(60);
  });

  test("success still returns the server-derived identity", async () => {
    expect(await requireLlmChatActor({ planBudget: false }, dependencies())).toEqual({
      data: { sbUserId: "owner", clerkUserId: "clerk-owner" },
      error: null,
    });
  });
});
