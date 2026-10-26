"use client";

import { useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/third-party/ui/button";
import {
  HEARTBEAT_PAGE_SIZE,
  HEARTBEAT_STATUSES,
  type HeartbeatDashboardResponse,
} from "@/lib/admin/heartbeat-telemetry";

const inputClass =
  "h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const number = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
const ms = (value: number | null) => (value === null ? "—" : `${number(value)} ms`);
const usd = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }).format(value);
const rate = (part: number, total: number) => (total ? `${number((part / total) * 100)}%` : "—");

async function fetchTelemetry(url: string): Promise<HeartbeatDashboardResponse> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });

  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "Admin access is required."
        : "Heartbeat telemetry unavailable. Check the telemetry migrations and retry."
    );

  return response.json();
}

export function HeartbeatDashboard() {
  const [query, setQuery] = useState({ hours: "24", status: "all", offset: 0, until: "" });
  const params = new URLSearchParams({
    hours: query.hours,
    status: query.status,
    offset: String(query.offset),
  });

  if (query.until) params.set("until", query.until);
  const { data, error, isValidating, mutate } = useSWR<HeartbeatDashboardResponse>(
    `/api/admin/heartbeats?${params}`,
    fetchTelemetry,
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false }
  );
  const summary = data?.summary;
  const refresh = () => {
    if (query.offset || query.until) setQuery({ ...query, offset: 0, until: "" });
    else void mutate();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Multiagent heartbeats</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          System metrics across all accounts. Snapshot contents and account identifiers are
          excluded. Measurements describe observed polls; collection is best effort.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Time window</span>
          <select
            className={inputClass}
            value={query.hours}
            onChange={(event) =>
              setQuery({ ...query, hours: event.target.value, offset: 0, until: "" })
            }
          >
            <option value="1">Last hour</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span className="block">Outcome</span>
          <select
            className={inputClass}
            value={query.status}
            onChange={(event) =>
              setQuery({ ...query, status: event.target.value, offset: 0, until: "" })
            }
          >
            <option value="all">All outcomes</option>
            {HEARTBEAT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={isValidating} onClick={refresh}>
          Refresh
        </Button>
        <p role="status" className="pb-2 text-xs text-muted-foreground">
          {isValidating
            ? "Loading heartbeats…"
            : data
              ? `Window ending ${new Date(data.until).toLocaleString()}`
              : ""}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error.message}
        </p>
      ) : null}
      {summary ? (
        <>
          <section
            aria-label="Heartbeat overview"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {[
              [
                "Observed polls",
                number(summary.runs),
                `${number(summary.evaluations)} evaluated · ${rate(summary.evaluations, summary.runs)}`,
              ],
              [
                "Notable updates",
                number(summary.notable),
                `${rate(summary.notable, summary.evaluations)} of evaluations`,
              ],
              [
                "Input tokens",
                number(summary.input_tokens),
                `${number(summary.token_samples)} calls with input usage`,
              ],
              [
                "Reported evaluation cost",
                usd(summary.reported_cost),
                `${number(summary.cost_samples)} calls with reported cost`,
              ],
            ].map(([label, value, detail]) => (
              <div key={label} className="min-w-0 space-y-2 rounded-lg border border-border p-4">
                <h3 className="text-xs text-muted-foreground">{label}</h3>
                <p className="break-words text-xl font-medium tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            ))}
          </section>
          <div className="grid gap-6 md:grid-cols-2">
            <section aria-labelledby="measurements-heading" className="space-y-3">
              <h3 id="measurements-heading" className="text-sm font-medium">
                Measurements
              </h3>
              <dl className="divide-y divide-border rounded-lg border border-border px-4 text-xs">
                {[
                  [
                    "Input tokens · p50 / p95 / max",
                    `${number(summary.input_p50)} / ${number(summary.input_p95)} / ${number(summary.input_max)}`,
                  ],
                  ["Input tokens · mean per measured call", number(summary.input_avg)],
                  ["Output tokens · total", number(summary.output_tokens)],
                  [
                    "Heartbeat duration · p50 / p95",
                    `${ms(summary.duration_p50)} / ${ms(summary.duration_p95)}`,
                  ],
                  [
                    "Jev duration · p50 / p95",
                    `${ms(summary.evaluation_p50)} / ${ms(summary.evaluation_p95)}`,
                  ],
                  [
                    "Working agents per poll · mean / max",
                    `${number(summary.working_avg)} / ${number(summary.working_max)}`,
                  ],
                  ["Working-agent count · measured polls", number(summary.working_samples)],
                  ["Snapshot text · mean characters", number(summary.snapshot_chars_avg)],
                  ["Snapshot collection · mean duration", ms(summary.snapshot_duration_avg)],
                  ["Jev estimate · measured input × $0.04/M", usd(summary.jev_estimated_cost)],
                  ["Jev estimate · measured calls", number(summary.jev_estimate_samples)],
                  [
                    "Errors · share of polls",
                    `${number(summary.errors)} · ${rate(summary.errors, summary.runs)}`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section aria-labelledby="outcomes-heading" className="space-y-3">
              <h3 id="outcomes-heading" className="text-sm font-medium">
                Poll outcomes
              </h3>
              <div className="space-y-4 rounded-lg border border-border p-4">
                {data.statuses.length ? (
                  data.statuses.map((item) => (
                    <div key={item.status} className="space-y-2 text-xs">
                      <div className="flex justify-between gap-3">
                        <span>{item.status}</span>
                        <span className="tabular-nums">
                          {number(item.runs)} · {rate(item.runs, summary.runs)}
                        </span>
                      </div>
                      <div aria-hidden="true" className="h-1 rounded-full bg-muted">
                        <div
                          className="h-1 rounded-full bg-foreground/60"
                          style={{ width: `${(item.runs / summary.runs) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No heartbeats recorded in this window.
                  </p>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Working agents are counted per orchestrator poll, not globally distinct agents.
                Snapshot characters cover PREVIOUS + CURRENT text, excluding decision instructions.
                Duration starts after authentication and request validation, and ends before
                background queue dispatch and telemetry persistence.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Costs cover the heartbeat evaluator only. Orchestrator replies, tools, and workers
                are excluded. Reported cost and the Jev estimate overlap; do not add them together
                or add them to the billing ledger. Missing values appear as —.
              </p>
            </section>
          </div>
          <section aria-labelledby="runs-heading" className="space-y-3">
            <h3 id="runs-heading" className="text-sm font-medium">
              Individual polls
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Recent heartbeat polls, newest first. Working and total agent counts are measured
                  per poll.
                </caption>
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    {[
                      "Recorded",
                      "Outcome",
                      "Agents working / total",
                      "Input / output tokens",
                      "Heartbeat / Jev",
                      "Reported cost",
                      "Details",
                    ].map((label) => (
                      <th scope="col" key={label} className="p-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/40 align-top last:border-0">
                      <td className="whitespace-nowrap p-3">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                      <td className="p-3">{run.status}</td>
                      <td className="whitespace-nowrap p-3 tabular-nums">
                        {number(run.working_subagent_count)} / {number(run.subagent_count)}
                      </td>
                      <td className="whitespace-nowrap p-3 tabular-nums">
                        {number(run.input_tokens)} / {number(run.output_tokens)}
                      </td>
                      <td className="whitespace-nowrap p-3 tabular-nums">
                        {ms(run.duration_ms)} / {ms(run.evaluation_duration_ms)}
                      </td>
                      <td className="whitespace-nowrap p-3 tabular-nums">{usd(run.cost_usd)}</td>
                      <td className="min-w-48 p-3">
                        <details>
                          <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {run.event_count} events · {run.stage}
                          </summary>
                          <dl className="mt-2 space-y-1 text-muted-foreground">
                            <div>
                              <dt className="inline">Model: </dt>
                              <dd className="inline">{run.model_id ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="inline">Provider: </dt>
                              <dd className="inline">{run.provider ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="inline">Snapshot: </dt>
                              <dd className="inline">
                                {number(run.snapshot_chars)} chars · {ms(run.snapshot_duration_ms)}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline">Error: </dt>
                              <dd className="inline">{run.error_code ?? "—"}</dd>
                            </div>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.runs.length ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No polls on this page. Try a wider window or another outcome.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                disabled={isValidating || query.offset === 0}
                onClick={() =>
                  setQuery({
                    ...query,
                    until: data.until,
                    offset: Math.max(0, query.offset - HEARTBEAT_PAGE_SIZE),
                  })
                }
              >
                Newer
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {data.runs.length ? `${query.offset + 1}–${query.offset + data.runs.length}` : "0"}{" "}
                of {number(summary.runs)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  isValidating ||
                  query.offset + HEARTBEAT_PAGE_SIZE >= summary.runs ||
                  query.offset >= 10_000
                }
                onClick={() =>
                  setQuery({
                    ...query,
                    until: data.until,
                    offset: query.offset + HEARTBEAT_PAGE_SIZE,
                  })
                }
              >
                Older
              </Button>
            </div>
          </section>
        </>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Recent raw telemetry only (up to seven days). Older runs compact into hourly summaries after
        ten days. Historical rows may lack newly added measurements. Refresh manually to update.
      </p>
    </div>
  );
}
