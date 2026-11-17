import { Check, Minus, X } from "lucide-react";

import { PerfSparkline } from "./PerfSparkline";

import {
  isPerfDuration,
  PERF_JOURNEY_LABELS,
  PERF_PHASE_LABELS,
  PERF_JOURNEYS,
} from "@/lib/perf/journeys";
import { perfBudgetFor, PERF_MIN_SAMPLES_P95, PERF_MIN_SAMPLES_P99 } from "@/lib/perf/budgets";
import {
  isP95Reliable,
  isP99Reliable,
  perfVerdict,
  reliableDailyP95,
  type PerfDailyRow,
  type PerfSummaryRow,
} from "@/lib/perf/summary-core";

const ms = (value: number) => `${Math.round(value)} ms`;

function Percentile({ value, reliable, need }: { value: number; reliable: boolean; need: number }) {
  if (reliable) return <>{ms(value)}</>;

  return (
    <span className="text-muted-foreground" title={`Needs at least ${need} samples`}>
      <span aria-hidden>—</span>
      <span className="sr-only">Not enough samples (needs {need})</span>
    </span>
  );
}

function Verdict({ row }: { row: PerfSummaryRow }) {
  const verdict = perfVerdict(row);
  const budget = perfBudgetFor(row.journey);

  if (verdict.pass === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus aria-hidden className="size-3.5" /> Not enough data
      </span>
    );
  }

  return verdict.pass ? (
    <span className="inline-flex items-center gap-1">
      <Check aria-hidden className="size-3.5" /> Meets {budget} ms at {verdict.level}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-destructive">
      <X aria-hidden className="size-3.5" /> Misses {budget} ms at {verdict.level}
    </span>
  );
}

/** Thin meter: share of samples at or under the budget. The percentage beside it carries the value. */
function Meter({ share, budget }: { share: number; budget: number }) {
  const pct = Math.round(share * 100);

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-label={`${pct}% of samples at or under ${budget} milliseconds`}
        className="h-1 w-20 overflow-hidden rounded-full bg-muted"
        role="img"
      >
        <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">{pct}%</span>
    </span>
  );
}

const th =
  "px-2 py-2 text-left text-2xs font-medium uppercase tracking-wider text-muted-foreground";
const td = "px-2 py-2 align-middle text-xs tabular-nums";

export function PerfSummaryTable({
  rows,
  daily,
}: {
  rows: PerfSummaryRow[];
  daily: PerfDailyRow[];
}) {
  const journeyRows = rows.filter((r) => r.kind === "journey");

  return (
    <div className="space-y-8">
      <section aria-labelledby="journeys-heading" className="space-y-2">
        <h2 className="text-sm font-medium" id="journeys-heading">
          Whole actions
        </h2>
        <p className="text-xs text-muted-foreground">
          Each row is one action on one kind of page and device. A percentile appears only when
          there are enough samples to mean something (p95 needs {PERF_MIN_SAMPLES_P95}, p99 needs{" "}
          {PERF_MIN_SAMPLES_P99}); until then the verdict says so instead of guessing.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[56rem] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Action</th>
                <th className={th}>Page</th>
                <th className={th}>Device</th>
                <th className={`${th} text-right`}>Samples</th>
                <th className={`${th} text-right`}>p50</th>
                <th className={`${th} text-right`}>p95</th>
                <th className={`${th} text-right`}>p99</th>
                <th className={th}>Under budget</th>
                <th className={th}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {journeyRows.map((row) => (
                <tr
                  key={`${row.journey}|${row.phase}|${row.route}|${row.device}`}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className={`${td} font-sans text-foreground`}>
                    {PERF_JOURNEY_LABELS[row.journey]}
                  </td>
                  <td className={td}>{row.route}</td>
                  <td className={td}>{row.device}</td>
                  <td className={`${td} text-right`}>{row.samples}</td>
                  <td className={`${td} text-right`}>{ms(row.p50)}</td>
                  <td className={`${td} text-right`}>
                    <Percentile
                      need={PERF_MIN_SAMPLES_P95}
                      reliable={isP95Reliable(row.samples)}
                      value={row.p95}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <Percentile
                      need={PERF_MIN_SAMPLES_P99}
                      reliable={isP99Reliable(row.samples)}
                      value={row.p99}
                    />
                  </td>
                  <td className={td}>
                    <Meter budget={perfBudgetFor(row.journey)} share={row.withinBudget} />
                  </td>
                  <td className={`${td} font-sans`}>
                    <Verdict row={row} />
                  </td>
                </tr>
              ))}
              {journeyRows.length === 0 ? (
                <tr>
                  <td className={`${td} text-muted-foreground`} colSpan={9}>
                    No whole-action measurements in this window yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="space-y-2">
        <h2 className="text-sm font-medium" id="trend-heading">
          Daily p95 trend
        </h2>
        <ul className="divide-y divide-border/60 rounded-lg border border-border">
          {PERF_JOURNEYS.map((journey) => (
            <li key={journey} className="flex items-center justify-between gap-4 px-3 py-2">
              <span className="text-xs">{PERF_JOURNEY_LABELS[journey]}</span>
              <PerfSparkline
                label={PERF_JOURNEY_LABELS[journey]}
                points={reliableDailyP95(daily, journey)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-heading" className="space-y-2">
        <h2 className="text-sm font-medium" id="steps-heading">
          Where the time goes
        </h2>
        <p className="text-xs text-muted-foreground">
          For each action: <em>time spent</em> is how long a part took (server work, downloads,
          fonts, scripts, the main thread). They overlap, so they do not add up to the total.{" "}
          <em>Milestones</em> are when something happened, counted from the start of the action.
        </p>
        {PERF_JOURNEYS.map((journey) => {
          const steps = rows.filter((r) => r.kind === "phase" && r.journey === journey);
          const spent = steps.filter((r) => isPerfDuration(r.phase)).sort((a, b) => b.p50 - a.p50);
          const milestones = steps
            .filter((r) => !isPerfDuration(r.phase))
            .sort((a, b) => a.p50 - b.p50);

          if (steps.length === 0) return null;

          return (
            <details key={journey} className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-xs">{PERF_JOURNEY_LABELS[journey]}</summary>
              <StepsTable kind="Time spent" rows={spent} />
              <StepsTable kind="Milestone (since the start)" rows={milestones} />
            </details>
          );
        })}
      </section>
    </div>
  );
}

function StepsTable({ kind, rows }: { kind: string; rows: PerfSummaryRow[] }) {
  if (rows.length === 0) return null;

  return (
    <table className="mt-2 w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className={th}>{kind}</th>
          <th className={th}>Page</th>
          <th className={th}>Device</th>
          <th className={`${th} text-right`}>Samples</th>
          <th className={`${th} text-right`}>p50</th>
          <th className={`${th} text-right`}>p95</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.phase}|${row.route}|${row.device}`}
            className="border-b border-border/60 last:border-0"
          >
            <td className={`${td} font-sans`}>{PERF_PHASE_LABELS[row.phase] ?? row.phase}</td>
            <td className={td}>{row.route}</td>
            <td className={td}>{row.device}</td>
            <td className={`${td} text-right`}>{row.samples}</td>
            <td className={`${td} text-right`}>{ms(row.p50)}</td>
            <td className={`${td} text-right`}>
              <Percentile
                need={PERF_MIN_SAMPLES_P95}
                reliable={isP95Reliable(row.samples)}
                value={row.p95}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
