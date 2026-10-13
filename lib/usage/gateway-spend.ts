import "server-only";

import { gateway } from "@ai-sdk/gateway";

import type { GatewaySpendSummary } from "@/lib/usage/types";

const SPEND_CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<GatewaySpendSummary> }>();

/** Admin-only caller. The unfiltered report covers the Gateway account, not just this app. */
export function getGatewaySpendSummary(args: {
  ownerId: string;
  startDate: string;
  endDate: string;
}): Promise<GatewaySpendSummary> {
  const key = JSON.stringify(args);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.at < SPEND_CACHE_MS) return existing.value;
  for (const [entryKey, entry] of cache) {
    if (Date.now() - entry.at >= SPEND_CACHE_MS) cache.delete(entryKey);
  }
  const value = (async (): Promise<GatewaySpendSummary> => {
    try {
      const range = { startDate: args.startDate, endDate: args.endDate };
      const [account, attributed] = await Promise.all([
        gateway.getSpendReport(range),
        gateway.getSpendReport({ ...range, userId: args.ownerId }),
      ]);
      const sum = (rows: Array<{ totalCost: number }>) => rows.reduce(
        (total, row) => total + (Number.isFinite(row.totalCost) ? row.totalCost : 0), 0
      );
      return {
        status: "available",
        accountCostUsd: sum(account.results),
        attributedCostUsd: sum(attributed.results),
        asOf: new Date().toISOString(),
      };
    } catch {
      return { status: "unavailable" };
    }
  })();
  cache.set(key, { at: Date.now(), value });
  return value;
}
