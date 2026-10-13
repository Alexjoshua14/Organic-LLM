/**
 * Weekly budget windows. Each user's windows repeat every {@link BUDGET_CYCLE_DAYS} days from
 * their own anchor (`account_entitlements.cycle_anchor`); spending a reset moves the anchor to
 * now, which starts a fresh window. Earlier windows are counted back in whole cycles from the
 * current window's start.
 */

export const BUDGET_CYCLE_DAYS = 7;
export const BUDGET_CYCLE_MS = BUDGET_CYCLE_DAYS * 86_400_000;

/**
 * Anchor used when a user has no entitlement row yet (migration not applied): a Monday,
 * 00:00 UTC, so everyone's window turns over at the start of the week.
 */
export const DEFAULT_BUDGET_CYCLE_ANCHOR = new Date("2026-01-05T00:00:00.000Z");

export type BudgetCycle = { start: Date; end: Date };

/** The window containing `now`. */
export function currentBudgetCycle(anchor: Date, now: Date): BudgetCycle {
  const elapsed = now.getTime() - anchor.getTime();
  const index = Math.floor(elapsed / BUDGET_CYCLE_MS);
  const start = new Date(anchor.getTime() + index * BUDGET_CYCLE_MS);

  return { start, end: new Date(start.getTime() + BUDGET_CYCLE_MS) };
}

/** Usage views, in budget cycles rather than day counts. */
export const BUDGET_CYCLE_RANGES = ["current", "previous", "last3", "last6"] as const;
export type BudgetCycleRange = (typeof BUDGET_CYCLE_RANGES)[number];

export const BUDGET_CYCLE_RANGE_LABELS: Record<BudgetCycleRange, string> = {
  current: "Current cycle",
  previous: "Previous cycle",
  last3: "Last 3 cycles",
  last6: "Last 6 cycles",
};

export function isBudgetCycleRange(value: string | null | undefined): value is BudgetCycleRange {
  return (BUDGET_CYCLE_RANGES as readonly string[]).includes(value ?? "");
}

/**
 * Time span a range covers. `previous` is the one full cycle before the current one; `lastN`
 * runs from N−1 cycles before the current window's start through now (current included).
 */
export function budgetCycleRangeSpan(
  range: BudgetCycleRange,
  anchor: Date,
  now: Date
): { start: Date; end: Date } {
  const current = currentBudgetCycle(anchor, now);
  const back = (cycles: number) => new Date(current.start.getTime() - cycles * BUDGET_CYCLE_MS);

  switch (range) {
    case "previous":
      return { start: back(1), end: current.start };
    case "last3":
      return { start: back(2), end: now };
    case "last6":
      return { start: back(5), end: now };
    default:
      return { start: current.start, end: now };
  }
}

/** "3d 4h", "5h 12m", "8m" — time until the window resets. */
export function formatResetCountdown(msUntilReset: number): string {
  const minutes = Math.max(0, Math.ceil(msUntilReset / 60_000));
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;

  return `${mins}m`;
}
