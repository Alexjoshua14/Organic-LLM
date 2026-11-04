import { describe, expect, mock, test } from "bun:test";

import { createHeartbeatTelemetryHandler } from "@/lib/api/heartbeat-telemetry-handler";
import { HeartbeatDashboardSchema } from "@/lib/admin/heartbeat-telemetry";
import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";

const now = Date.parse("2026-10-25T12:00:00Z");
const empty = {
  summary: {
    runs: 0,
    evaluations: 0,
    notable: 0,
    errors: 0,
    input_tokens: null,
    output_tokens: null,
    token_samples: 0,
    input_avg: null,
    input_p50: null,
    input_p95: null,
    input_max: null,
    duration_p50: null,
    duration_p95: null,
    evaluation_p50: null,
    evaluation_p95: null,
    working_avg: null,
    working_max: null,
    working_samples: 0,
    snapshot_chars_avg: null,
    snapshot_duration_avg: null,
    reported_cost: null,
    cost_samples: 0,
    jev_estimated_cost: null,
    jev_estimate_samples: 0,
  },
  statuses: [],
  runs: [],
};
const request = (query = "") => new Request(`https://organic.test/api/admin/heartbeats${query}`);
function fixture(admin = true) {
  const read = mock(async (_query: unknown): Promise<unknown> => empty);
  const handler = createHeartbeatTelemetryHandler({
    requireAdmin: async () => (admin ? { clerkUserId: "admin", sbUserId: "profile" } : null),
    read,
    now: () => now,
  });
  return { read, handler };
}

describe("admin heartbeat telemetry", () => {
  test("denies non-admins before any read and forbids caching on errors too", async () => {
    const { handler, read } = fixture(false);
    const response = await handler(request());
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(read).not.toHaveBeenCalled();
  });

  test("bounds windows and pagination and rejects arbitrary filters", async () => {
    const { handler, read } = fixture();
    for (const query of [
      "?hours=720",
      "?hours=0",
      "?offset=-1",
      "?offset=10001",
      "?offset=0.5",
      "?status=anything",
      "?ownerId=private",
      "?until=2026-10-20T12:00:00Z",
      "?until=2026-10-26T12:00:00Z",
    ]) {
      expect((await handler(request(query))).status).toBe(400);
    }
    expect(read).not.toHaveBeenCalled();
    const response = await handler(request("?hours=168&status=notable&offset=50"));
    expect(response.status).toBe(200);
    expect(read).toHaveBeenCalledWith({
      hours: 168,
      status: "notable",
      offset: 50,
      until: new Date(now).toISOString(),
    });
  });

  test("strips identifiers, content, and unexpected provider fields at the response boundary", async () => {
    const { handler, read } = fixture();
    read.mockImplementation(async () => ({
      ...empty,
      owner_id: "private-account",
      prompt: "private-prompt",
      runs: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          started_at: new Date(now).toISOString(),
          status: "notable",
          stage: "finished",
          subagent_count: 3,
          working_subagent_count: 1,
          duration_ms: 200,
          evaluation_duration_ms: 100,
          snapshot_chars: 900,
          snapshot_duration_ms: 80,
          input_tokens: 1000,
          output_tokens: 0,
          cost_usd: 0.00004,
          event_count: 1,
          model_id: "typesafe-ai/jev",
          provider: "typesafe-ai",
          error_code: null,
          thread_id: "private-thread",
          owner_id: "private-owner",
          snapshot: "private-text",
          providerMetadata: { secret: "private-payload" },
        },
      ],
    }));
    const response = await handler(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.runs[0].input_tokens).toBe(1000);
    expect(JSON.stringify(body)).not.toContain("private-");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  test("outages and invalid database responses expose no raw errors or fabricated zeros", async () => {
    const { handler, read } = fixture();
    expect((await (await handler(request())).json()).summary.input_tokens).toBeNull();
    read.mockImplementation(async () => {
      throw new Error("private SQL and connection string");
    });
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private SQL");
    read.mockImplementation(async () => ({ ...empty, summary: { ...empty.summary, runs: -1 } }));
    expect((await handler(request())).status).toBe(503);
    expect(HeartbeatDashboardSchema.safeParse(empty).success).toBe(true);
  });

  test("Jev's accounting fallback charges only input at the supplied rate", () => {
    expect(
      computeUsageCostUsd("typesafe-ai/jev", { inputTokens: 1_000_000, outputTokens: 1_000_000 })
    ).toBe(0.04);
    expect(computeUsageCostUsd("typesafe-ai/jev", { inputTokens: 0, outputTokens: 10_000 })).toBe(
      0
    );
  });
});
