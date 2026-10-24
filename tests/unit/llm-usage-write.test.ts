import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { insertLlmUsageEvent } from "@/data/supabase/llm-usage";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { recordGatewayCallUsage } from "@/lib/usage/record-gateway-call";
import { sumLlmUsageCostUsd } from "@/data/supabase/llm-usage";
import { computeUsageCostUsd } from "@/lib/rate-limit/llm-cost";

let restore: { mockRestore(): void } | undefined;
afterEach(() => restore?.mockRestore());
describe("usage charge persistence", () => {
  test("a billed charge survives missing token details, without inventing tokens", async () => {
    const insert = mock(async () => ({ error: null }));
    restore = spyOn(supabaseAdmin, "from").mockImplementation(() => ({ insert }) as never);
    await recordGatewayCallUsage({
      ownerId: "trusted-owner",
      modelId: "openai/test",
      operation: "test",
      providerMetadata: { gateway: { cost: "0.012345" } },
    });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      owner_id: "trusted-owner",
      cost_usd: 0.012345,
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
    });
  });
  test("persistence errors propagate instead of silently reporting a recorded charge", async () => {
    restore = spyOn(supabaseAdmin, "from").mockImplementation(
      () => ({ insert: async () => ({ error: { message: "permission denied" } }) }) as never
    );
    await expect(
      insertLlmUsageEvent({
        ownerId: "trusted-owner",
        modelId: "openai/test",
        inputTokens: 10,
        costUsdOverride: 1,
      })
    ).rejects.toThrow("Usage could not be recorded");
  });
  test("a missing or malformed database sum is never authorized as zero", async () => {
    for (const data of [null, undefined, "", " ", "NaN", -1]) {
      restore = spyOn(supabaseAdmin, "rpc").mockImplementation(
        async () => ({ data, error: null }) as never
      );
      expect(
        (
          await sumLlmUsageCostUsd({
            ownerId: "trusted-owner",
            since: new Date(0),
            until: new Date(),
          })
        ).status
      ).toBe("error");
      restore.mockRestore();
    }
  });
  test("unknown cache prices retain the input estimate and cached tokens remain a subset", () => {
    const model = "unpriced/provider-model";
    expect(computeUsageCostUsd(model, { inputTokens: 100, cachedInputTokens: 100 })).toBe(
      computeUsageCostUsd(model, { inputTokens: 100 })
    );
    expect(computeUsageCostUsd(model, { inputTokens: 100, cachedInputTokens: 200 })).toBe(
      computeUsageCostUsd(model, { inputTokens: 100 })
    );
  });
});
