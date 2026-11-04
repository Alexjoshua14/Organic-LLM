import { describe, expect, mock, spyOn, test } from "bun:test";

import { Logger } from "@/lib/logger";

import { ProfileNotFoundError } from "@/data/supabase/profile-id-lookup";
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

  test("503 logs name the failure without its message", async () => {
    const errorLog = spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const deps = dependencies();

    deps.activeStreams = async () => {
      throw Object.assign(new TypeError("password=hunter2 at db.internal"), { code: "57P01" });
    };

    try {
      await requireLlmChatActor({}, deps);
      expect(errorLog.mock.calls[0]?.[2]).toEqual({
        stage: "stream_capacity",
        errorName: "TypeError",
        errorCode: "57P01",
      });
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain("hunter2");
    } finally {
      errorLog.mockRestore();
    }
  });

  test("quota denial retains reset timing for Retry-After", async () => {
    const deps = dependencies();
    deps.messageLimit = async () => ({ success: false, reset: Date.now() + 60_000 });
    const response = (await requireLlmChatActor({}, deps)).error!;

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(59);
    expect(Number(response.headers.get("Retry-After"))).toBeLessThanOrEqual(60);
  });

  test("quota denial with a missing or past reset still answers 429", async () => {
    const deps = dependencies();

    deps.messageLimit = async () => ({ success: false });
    const noReset = (await requireLlmChatActor({}, deps)).error!;

    expect(noReset.status).toBe(429);
    expect(noReset.headers.get("Retry-After")).toBeNull();

    deps.messageLimit = async () => ({ success: false, reset: Date.now() - 5_000 });
    const pastReset = (await requireLlmChatActor({}, deps)).error!;

    expect(pastReset.status).toBe(429);
    expect(pastReset.headers.get("Retry-After")).toBe("1");
  });

  test("a lookup with no row and no error is a missing profile", async () => {
    const deps = dependencies();

    deps.profile = async () => ({ data: null, error: null });
    const response = (await requireLlmChatActor({}, deps)).error!;

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "profile_not_found" });
  });

  test("stream cap denial is a 429 before the plan budget is read", async () => {
    const deps = dependencies();

    deps.activeStreams = async () => 5;
    const budget = mock(deps.budget);

    deps.budget = budget;
    const response = (await requireLlmChatActor({}, deps)).error!;

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "stream_limit" });
    expect(budget).not.toHaveBeenCalled();
  });

  test("every rejection is marked no-store", async () => {
    const cases: Array<[number, (deps: Deps) => void]> = [
      [401, (deps) => (deps.userId = async () => null)],
      [
        404,
        (deps) => (deps.profile = async () => ({ data: null, error: new ProfileNotFoundError() })),
      ],
      [429, (deps) => (deps.messageLimit = async () => ({ success: false }))],
      [429, (deps) => (deps.activeStreams = async () => 5)],
    ];

    for (const [status, configure] of cases) {
      const deps = dependencies();

      configure(deps);
      const response = (await requireLlmChatActor({ planBudget: false }, deps)).error!;

      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  test("success still returns the server-derived identity", async () => {
    expect(await requireLlmChatActor({ planBudget: false }, dependencies())).toEqual({
      data: { sbUserId: "owner", clerkUserId: "clerk-owner" },
      error: null,
    });
  });
});
