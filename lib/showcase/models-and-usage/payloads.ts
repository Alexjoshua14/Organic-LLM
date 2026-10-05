/**
 * Synthetic usage for the Milky Way planning demo. Costs use the list rates in
 * `lib/rate-limit/llm-cost.ts` (`computeUsageCostUsd`), so the figures are estimates,
 * not an account bill.
 *
 * Each preset is a longer slice of one fictional stretch — a short run of active days,
 * not a zero-filled 30- or 90-day calendar. `totals.totalTokens` equals the sum of
 * those daily buckets, and `byModel` costs sum to `totals.costUsd`.
 */

import type { UsageApiPayload } from "@/lib/usage/types";
import type {
  UsageDailyBucket,
  UsageModelBreakdown,
  UsageRangePreset,
  UsageTotals,
} from "@/lib/usage/aggregate";

import { computeUsageCostUsd, getModelCost, MODEL_PRICING_AS_OF } from "@/lib/rate-limit/llm-cost";
import { emptyUsageTotals } from "@/lib/usage/aggregate";
import { computePlanAllotmentPercent, USAGE_PLAN_TIERS } from "@/lib/usage/plans";
import {
  SHOWCASE_FROM_MODEL_ID,
  SHOWCASE_TO_MODEL_ID,
} from "@/lib/showcase/models-and-usage/script";

export const SHOWCASE_USAGE_DEFAULT_PERIOD: UsageRangePreset = "30d";

/** Fixed fictional cycle so the label does not shift with the viewer's timezone. */
export const SHOWCASE_BILLING_CYCLE_LABEL = "Oct 1 – Oct 4";

const WEEK_START = "2026-09-28";
const MONTH_START = "2026-09-23";
const BILLING_START = "2026-10-01";
const BILLING_END = "2026-10-04";

type ShowcaseCall = {
  date: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

const research = SHOWCASE_FROM_MODEL_ID;
const planning = SHOWCASE_TO_MODEL_ID;

/**
 * One call per day, in order. Early days are research on the faster model.
 * The week switches to the stronger model for the plan, including one short voice question.
 */
const CALLS: readonly ShowcaseCall[] = [
  {
    date: "2026-09-19",
    modelId: research,
    inputTokens: 18_000,
    outputTokens: 2_000,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-20",
    modelId: research,
    inputTokens: 14_000,
    outputTokens: 1_600,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-21",
    modelId: research,
    inputTokens: 22_000,
    outputTokens: 2_400,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-22",
    modelId: research,
    inputTokens: 12_000,
    outputTokens: 1_400,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-23",
    modelId: research,
    inputTokens: 40_000,
    outputTokens: 4_000,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-24",
    modelId: research,
    inputTokens: 32_000,
    outputTokens: 3_200,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-25",
    modelId: research,
    inputTokens: 48_000,
    outputTokens: 5_000,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-26",
    modelId: research,
    inputTokens: 28_000,
    outputTokens: 2_800,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-27",
    modelId: research,
    inputTokens: 36_000,
    outputTokens: 3_600,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-28",
    modelId: research,
    inputTokens: 90_000,
    outputTokens: 9_000,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-29",
    modelId: research,
    inputTokens: 110_000,
    outputTokens: 11_000,
    cachedInputTokens: 0,
  },
  {
    date: "2026-09-30",
    modelId: planning,
    inputTokens: 40_000,
    outputTokens: 8_000,
    cachedInputTokens: 6_000,
  },
  {
    date: "2026-10-01",
    modelId: planning,
    inputTokens: 48_000,
    outputTokens: 10_000,
    cachedInputTokens: 8_000,
  },
  {
    date: "2026-10-02",
    modelId: planning,
    inputTokens: 36_000,
    outputTokens: 7_000,
    cachedInputTokens: 4_000,
  },
  {
    date: "2026-10-03",
    modelId: planning,
    inputTokens: 12_000,
    outputTokens: 2_000,
    cachedInputTokens: 0,
  },
  {
    date: "2026-10-04",
    modelId: planning,
    inputTokens: 20_000,
    outputTokens: 4_000,
    cachedInputTokens: 2_000,
  },
];

function callsFor(preset: UsageRangePreset): readonly ShowcaseCall[] {
  if (preset === "7d") return CALLS.filter((call) => call.date >= WEEK_START);
  if (preset === "30d") return CALLS.filter((call) => call.date >= MONTH_START);

  return CALLS;
}

function costMicro(call: ShowcaseCall): number {
  const usd = computeUsageCostUsd(call.modelId, {
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    cachedInputTokens: call.cachedInputTokens,
  });

  return Math.round(usd * 1_000_000);
}

function fromMicro(micro: number): number {
  return micro / 1_000_000;
}

type ModelAccum = UsageModelBreakdown & { costMicro: number };

function aggregateCalls(calls: readonly ShowcaseCall[]): {
  totals: UsageTotals;
  daily: UsageDailyBucket[];
  byModel: UsageApiPayload["byModel"];
} {
  const totals = emptyUsageTotals();
  let totalMicro = 0;
  const daily: UsageDailyBucket[] = [];
  const dayMicro = new Map<string, number>();
  const modelMap = new Map<string, ModelAccum>();

  for (const call of calls) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(call.date)) {
      throw new Error(`Showcase usage date must be ISO YYYY-MM-DD: ${call.date}`);
    }
    if (call.cachedInputTokens > call.inputTokens) {
      throw new Error(`Cached tokens exceed input on ${call.date}`);
    }

    const micro = costMicro(call);
    const totalTokens = call.inputTokens + call.outputTokens;

    totalMicro += micro;
    totals.inputTokens += call.inputTokens;
    totals.cachedInputTokens += call.cachedInputTokens;
    totals.outputTokens += call.outputTokens;
    totals.totalTokens += totalTokens;
    totals.callCount += 1;

    let day = daily.find((bucket) => bucket.date === call.date);

    if (!day) {
      day = { date: call.date, totalTokens: 0, costUsd: 0, callCount: 0 };
      daily.push(day);
    }

    day.totalTokens += totalTokens;
    day.callCount += 1;
    dayMicro.set(call.date, (dayMicro.get(call.date) ?? 0) + micro);

    const model = modelMap.get(call.modelId) ?? {
      modelId: call.modelId,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      callCount: 0,
      costMicro: 0,
    };

    model.inputTokens += call.inputTokens;
    model.cachedInputTokens += call.cachedInputTokens;
    model.outputTokens += call.outputTokens;
    model.totalTokens += totalTokens;
    model.callCount += 1;
    model.costMicro += micro;
    modelMap.set(call.modelId, model);
  }

  for (const day of daily) {
    day.costUsd = fromMicro(dayMicro.get(day.date) ?? 0);
  }

  totals.costUsd = fromMicro(totalMicro);

  const byModel = Array.from(modelMap.values())
    .sort((a, b) => b.costMicro - a.costMicro)
    .map((row) => {
      const pricing = getModelCost(row.modelId);

      return {
        modelId: row.modelId,
        inputTokens: row.inputTokens,
        cachedInputTokens: row.cachedInputTokens,
        outputTokens: row.outputTokens,
        reasoningTokens: row.reasoningTokens,
        totalTokens: row.totalTokens,
        costUsd: fromMicro(row.costMicro),
        callCount: row.callCount,
        inputPerMillion: pricing.inputPerMillion,
        outputPerMillion: pricing.outputPerMillion,
        ...(pricing.cachedInputPerMillion !== undefined
          ? { cachedInputPerMillion: pricing.cachedInputPerMillion }
          : {}),
      };
    });

  const dailyTokens = daily.reduce((sum, day) => sum + day.totalTokens, 0);

  if (dailyTokens !== totals.totalTokens) {
    throw new Error("Showcase usage daily tokens do not sum to totals.totalTokens");
  }

  const modelMicro = Array.from(modelMap.values()).reduce((sum, row) => sum + row.costMicro, 0);

  if (modelMicro !== totalMicro) {
    throw new Error("Showcase usage model costs do not sum to totals.costUsd");
  }

  return { totals, daily, byModel };
}

const billingAgg = aggregateCalls(
  CALLS.filter((call) => call.date >= BILLING_START && call.date <= BILLING_END)
);

const planAllotments = USAGE_PLAN_TIERS.map((plan) => ({
  plan,
  percentUsed: computePlanAllotmentPercent({
    plan,
    billingCycleTokens: billingAgg.totals.totalTokens,
    billingCycleCostUsd: billingAgg.totals.costUsd,
  }),
}));

const billingCycle = {
  start: `${BILLING_START}T00:00:00.000Z`,
  end: `${BILLING_END}T23:59:59.000Z`,
};

function buildPayload(preset: UsageRangePreset): UsageApiPayload {
  const calls = callsFor(preset);
  const first = calls[0];
  const last = calls[calls.length - 1];

  if (!first || !last) throw new Error(`Showcase usage preset ${preset} has no calls`);

  const { totals, daily, byModel } = aggregateCalls(calls);

  return {
    range: {
      start: `${first.date}T00:00:00.000Z`,
      end: `${last.date}T23:59:59.000Z`,
      preset,
    },
    billingCycle,
    totals,
    billingCycleTotals: billingAgg.totals,
    daily,
    byModel,
    planAllotments,
    pricingAsOf: MODEL_PRICING_AS_OF,
  };
}

export const SHOWCASE_USAGE_BY_PERIOD: Record<UsageRangePreset, UsageApiPayload> = {
  "7d": buildPayload("7d"),
  "30d": buildPayload("30d"),
  "90d": buildPayload("90d"),
};

const RANGE_PRESETS = new Set<UsageRangePreset>(["7d", "30d", "90d"]);

/** Runtime shape check for a bundled payload. Throws on a missing or mistyped field. */
export function assertShowcaseUsagePayload(payload: UsageApiPayload): void {
  if (!RANGE_PRESETS.has(payload.range.preset)) {
    throw new Error(`Unexpected usage preset: ${payload.range.preset}`);
  }
  if (typeof payload.range.start !== "string" || typeof payload.range.end !== "string") {
    throw new Error("Usage range start and end must be strings");
  }

  const totalKeys = [
    "inputTokens",
    "cachedInputTokens",
    "outputTokens",
    "reasoningTokens",
    "totalTokens",
    "costUsd",
    "callCount",
  ] as const;

  for (const key of totalKeys) {
    const value = payload.totals[key];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`totals.${key} must be a finite number`);
    }
  }

  if (!Array.isArray(payload.daily) || payload.daily.length === 0) {
    throw new Error("daily must be a non-empty list");
  }
  if (!Array.isArray(payload.byModel) || payload.byModel.length === 0) {
    throw new Error("byModel must be a non-empty list");
  }
  if (!Array.isArray(payload.planAllotments) || payload.planAllotments.length === 0) {
    throw new Error("planAllotments must be a non-empty list");
  }

  for (const day of payload.daily) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      throw new Error(`daily date must be ISO YYYY-MM-DD: ${day.date}`);
    }
    if (typeof day.totalTokens !== "number" || typeof day.costUsd !== "number") {
      throw new Error(`daily bucket ${day.date} is missing tokens or cost`);
    }
  }

  for (const row of payload.byModel) {
    if (typeof row.modelId !== "string" || row.modelId.length === 0) {
      throw new Error("byModel row is missing modelId");
    }
    if (typeof row.inputTokens !== "number" || typeof row.outputTokens !== "number") {
      throw new Error(`byModel ${row.modelId} is missing token counts`);
    }
    if (typeof row.costUsd !== "number") throw new Error(`byModel ${row.modelId} is missing cost`);
    if (typeof row.inputPerMillion !== "number" || typeof row.outputPerMillion !== "number") {
      throw new Error(`byModel ${row.modelId} is missing list rates`);
    }
  }

  for (const allotment of payload.planAllotments) {
    if (typeof allotment.plan?.id !== "string" || typeof allotment.plan?.name !== "string") {
      throw new Error("planAllotments entries need plan.id and plan.name");
    }
    if (typeof allotment.percentUsed !== "number" || !Number.isFinite(allotment.percentUsed)) {
      throw new Error(`plan ${allotment.plan?.id ?? "?"} has a non-numeric percentUsed`);
    }
  }

  if (typeof payload.pricingAsOf !== "string" || payload.pricingAsOf.length === 0) {
    throw new Error("pricingAsOf must be a non-empty string");
  }
}
