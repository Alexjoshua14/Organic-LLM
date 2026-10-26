"use client";

import type { HeartbeatDashboardData } from "@/lib/admin/heartbeat-telemetry";

import { useState } from "react";

import { formatDuration, formatNumber, formatRate, formatUsd } from "./heartbeat-format";

import { CompositionBar } from "@/components/design-system/composition-bar";
import { cn } from "@/lib/utils";

type HeartbeatStatus = HeartbeatDashboardData["statuses"][number]["status"];

const outcomes: Record<HeartbeatStatus, { label: string; color: string }> = {
  unchanged: { label: "Unchanged", color: "var(--muted-foreground)" },
  notable: { label: "Notable", color: "var(--lumen-deep-oklch)" },
  quiet: { label: "Quiet", color: "var(--chart-2)" },
  error: { label: "Error", color: "var(--destructive)" },
  "no-subagents": { label: "No subagents", color: "var(--chart-3)" },
  unavailable: { label: "Unavailable", color: "var(--chart-5)" },
  "too-soon": { label: "Too soon", color: "var(--chart-4)" },
  "claimed-elsewhere": { label: "Claimed elsewhere", color: "var(--chart-1)" },
  "blocked-budget": { label: "Budget blocked", color: "var(--chart-5)" },
  "invalid-target": { label: "Invalid target", color: "var(--destructive)" },
};

function PollOutcomes({ data }: { data: HeartbeatDashboardData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = data.statuses.filter((item) => item.runs > 0);

  return (
    <section aria-labelledby="outcomes-heading" className="rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="outcomes-heading" className="text-sm font-medium">
          Poll outcomes
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatNumber(data.summary.runs)} polls
        </span>
      </div>
      {rows.length ? (
        <>
          <CompositionBar
            label="Breakdown of observed poll outcomes"
            variant="solid"
            selectedId={selectedId}
            onSelectionChange={setSelectedId}
            segments={rows.map((item) => ({
              id: item.status,
              value: item.runs,
              color: outcomes[item.status].color,
              ariaLabel: `${outcomes[item.status].label}: ${formatNumber(item.runs)} polls, ${formatRate(item.runs, data.summary.runs)}`,
            }))}
          />
          <ul aria-label="Poll outcome counts" className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            {rows.map((item) => (
              <li key={item.status} className="flex min-w-0 items-start gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: outcomes[item.status].color }}
                />
                <div className="min-w-0">
                  <span className={cn("block", selectedId === item.status && "font-medium")}>
                    {outcomes[item.status].label}
                  </span>
                  <span className="block tabular-nums text-muted-foreground">
                    {formatNumber(item.runs)} · {formatRate(item.runs, data.summary.runs)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No heartbeats recorded in this window.</p>
      )}
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-3 text-xs">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Jev input estimate</p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(data.summary.jev_estimate_samples)} measured calls · $0.04/M input tokens
          </p>
        </div>
        <p className="shrink-0 text-xs tabular-nums">
          {formatUsd(data.summary.jev_estimated_cost)}
        </p>
      </div>
    </section>
  );
}

function Measurements({ summary }: { summary: HeartbeatDashboardData["summary"] }) {
  const rows = [
    ["Input tokens", summary.input_p50, summary.input_p95, summary.input_max],
    ["Heartbeat (ms)", summary.duration_p50, summary.duration_p95, null],
    ["Jev (ms)", summary.evaluation_p50, summary.evaluation_p95, null],
  ] as const;

  return (
    <section
      aria-labelledby="measurements-heading"
      className="min-w-0 rounded-lg border border-border p-4"
    >
      <h3 id="measurements-heading" className="text-sm font-medium">
        Measurements
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">
            Measurement percentiles and maximums. Durations are in milliseconds. A dash means not
            measured.
          </caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="pb-2 pr-3 font-normal">
                Metric
              </th>
              {[
                ["p50", "50th percentile (median)"],
                ["p95", "95th percentile"],
                ["Max", "Maximum observed value"],
              ].map(([label, title]) => (
                <th key={label} scope="col" className="pb-2 pl-3 text-right font-normal">
                  <span title={title}>{label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {rows.map(([label, ...values]) => (
              <tr key={label}>
                <th scope="row" className="py-2 pr-3 font-normal text-muted-foreground">
                  {label}
                </th>
                {values.map((value, index) => (
                  <td key={index} className="whitespace-nowrap py-2 pl-3 text-right">
                    {formatNumber(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-xs">
        {[
          ["Input per call · mean", formatNumber(summary.input_avg)],
          ["Output tokens · total", formatNumber(summary.output_tokens)],
          [
            "Working agents / poll",
            `${formatNumber(summary.working_avg)} mean · ${formatNumber(summary.working_max)} max`,
          ],
          ["Polls with agent counts", formatNumber(summary.working_samples)],
          ["Snapshot chars · mean", formatNumber(summary.snapshot_chars_avg)],
          ["Snapshot collection · mean", formatDuration(summary.snapshot_duration_avg)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 space-y-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function HeartbeatSummary({ data }: { data: HeartbeatDashboardData }) {
  const { summary } = data;

  return (
    <>
      <section
        aria-label="Heartbeat overview"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4"
      >
        {[
          [
            "Observed polls",
            formatNumber(summary.runs),
            `${formatNumber(summary.evaluations)} evaluated · ${formatRate(summary.evaluations, summary.runs)}`,
          ],
          [
            "Notable updates",
            formatNumber(summary.notable),
            `${formatRate(summary.notable, summary.evaluations)} of evaluations`,
          ],
          [
            "Input tokens",
            formatNumber(summary.input_tokens),
            `${formatNumber(summary.token_samples)} measured calls`,
          ],
          [
            "Reported evaluation cost",
            formatUsd(summary.reported_cost),
            `${formatNumber(summary.cost_samples)} measured calls`,
          ],
        ].map(([label, value, detail]) => (
          <div key={label} className="min-w-0 space-y-1 bg-background p-3">
            <h3 className="text-xs text-muted-foreground">{label}</h3>
            <p className="break-words text-base font-medium tabular-nums sm:text-xl">{value}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Measurements summary={summary} />
        <div className="min-w-0 space-y-3">
          <PollOutcomes data={data} />
          <details className="rounded-lg border border-border px-4 py-3 text-xs">
            <summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Measurement notes
            </summary>
            <div className="mt-3 space-y-2 leading-relaxed text-muted-foreground">
              <p className="text-xs leading-relaxed">
                p50 is the median; p95 is the 95th percentile. A dash means a measurement is
                unavailable. Counts and percentiles cover observed polls, not just the page below.
              </p>
              <p className="text-xs leading-relaxed">
                Working agents are counted per orchestrator poll, not globally distinct agents.
                Snapshot characters cover PREVIOUS + CURRENT text, excluding decision instructions.
                Duration starts after authentication and request validation and ends before
                background queue dispatch and telemetry persistence.
              </p>
              <p className="text-xs leading-relaxed">
                Costs cover the heartbeat evaluator only. Orchestrator replies, tools, and workers
                are excluded. Reported cost and the Jev estimate overlap; do not add them together
                or add them to the billing ledger.
              </p>
              <p className="text-xs leading-relaxed">
                Recent raw telemetry covers up to seven days. Older runs compact into hourly
                summaries after ten days. Historical rows may lack newly added measurements.
              </p>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
