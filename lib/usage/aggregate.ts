export type LlmUsageEventRow = {
  id: string;
  owner_id: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  cost_usd: number;
  operation: string | null;
  route: string | null;
  created_at: string;
};

export type UsageRangePreset = "7d" | "30d" | "90d";

export type UsageDailyBucket = {
  date: string;
  totalTokens: number;
  costUsd: number;
  callCount: number;
};

export type UsageModelBreakdown = {
  modelId: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
  callCount: number;
};

export type UsageTotals = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
  callCount: number;
};

export type UsageSummary = {
  range: { start: string; end: string; preset: UsageRangePreset };
  billingCycle: { start: string; end: string };
  totals: UsageTotals;
  billingCycleTotals: UsageTotals;
  daily: UsageDailyBucket[];
  byModel: UsageModelBreakdown[];
};

export function usageRangeDays(preset: UsageRangePreset): number {
  switch (preset) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    default:
      return 30;
  }
}

export function startOfUtcDay(iso: string): string {
  const d = new Date(iso);

  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export function startOfBillingCycle(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function aggregateUsageEvents(
  events: LlmUsageEventRow[],
  rangeStart: Date,
  rangeEnd: Date
): Pick<UsageSummary, "totals" | "daily" | "byModel"> {
  const dailyMap = new Map<string, UsageDailyBucket>();
  const modelMap = new Map<string, UsageModelBreakdown>();
  const totals: UsageTotals = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    callCount: 0,
  };

  for (const event of events) {
    const created = new Date(event.created_at);

    if (created < rangeStart || created > rangeEnd) continue;

    totals.inputTokens += event.input_tokens;
    totals.cachedInputTokens += event.cached_input_tokens ?? 0;
    totals.outputTokens += event.output_tokens;
    totals.reasoningTokens += event.reasoning_tokens;
    totals.totalTokens += event.total_tokens;
    totals.costUsd += Number(event.cost_usd);
    totals.callCount += 1;

    const dayKey = startOfUtcDay(event.created_at).slice(0, 10);
    const daily = dailyMap.get(dayKey) ?? {
      date: dayKey,
      totalTokens: 0,
      costUsd: 0,
      callCount: 0,
    };

    daily.totalTokens += event.total_tokens;
    daily.costUsd += Number(event.cost_usd);
    daily.callCount += 1;
    dailyMap.set(dayKey, daily);

    const model = modelMap.get(event.model_id) ?? {
      modelId: event.model_id,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      callCount: 0,
    };

    model.inputTokens += event.input_tokens;
    model.cachedInputTokens += event.cached_input_tokens ?? 0;
    model.outputTokens += event.output_tokens;
    model.reasoningTokens += event.reasoning_tokens;
    model.totalTokens += event.total_tokens;
    model.costUsd += Number(event.cost_usd);
    model.callCount += 1;
    modelMap.set(event.model_id, model);
  }

  const daily = fillDailyBuckets(rangeStart, rangeEnd, dailyMap);

  const byModel = Array.from(modelMap.values()).sort((a, b) => b.costUsd - a.costUsd);

  return { totals, daily, byModel };
}

function fillDailyBuckets(
  rangeStart: Date,
  rangeEnd: Date,
  dailyMap: Map<string, UsageDailyBucket>
): UsageDailyBucket[] {
  const buckets: UsageDailyBucket[] = [];
  const cursor = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate())
  );
  const endDay = new Date(
    Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate())
  );

  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    const existing = dailyMap.get(key);

    buckets.push(
      existing ?? {
        date: key,
        totalTokens: 0,
        costUsd: 0,
        callCount: 0,
      }
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}

export function emptyUsageTotals(): UsageTotals {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    callCount: 0,
  };
}
