import type { StateName } from "./fieldLibrary";

export const DEFAULT_DURATION_MS = 500;

export const COGNITIVE_STATES: ReadonlySet<StateName> = new Set(["reasoning", "searching_memory"]);

export const TRANSITION_OVERRIDES: Array<{
  from?: StateName | "cognitive";
  to?: StateName | "cognitive";
  durationMs: number;
}> = [
  { from: "idle_ready", to: "listening", durationMs: 700 },
  { from: "listening", to: "ingesting", durationMs: 250 },
  { from: "cognitive", to: "web_search", durationMs: 200 },
  { from: "web_search", to: "cognitive", durationMs: 400 },
  { to: "writing_memory", durationMs: 600 },
  { from: "writing_memory", to: "idle_ready", durationMs: 800 },
];

function matchesSide(side: StateName | "cognitive" | undefined, state: StateName): boolean {
  if (side === undefined) return true;
  if (side === "cognitive") return COGNITIVE_STATES.has(state);

  return side === state;
}

/** First matching override wins; otherwise {@link DEFAULT_DURATION_MS}. */
export function resolveDuration(from: StateName, to: StateName): number {
  for (const row of TRANSITION_OVERRIDES) {
    const fromOk = matchesSide(row.from, from);
    const toOk = matchesSide(row.to, to);

    if (fromOk && toOk) return row.durationMs;
  }

  return DEFAULT_DURATION_MS;
}
