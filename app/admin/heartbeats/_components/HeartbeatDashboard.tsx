"use client";

import { useState } from "react";
import useSWR from "swr";

import { HeartbeatSummary } from "./HeartbeatSummary";
import { formatDuration as ms, formatNumber as number, formatUsd as usd } from "./heartbeat-format";

import { Button } from "@/components/third-party/ui/button";
import {
  HEARTBEAT_PAGE_SIZE,
  HEARTBEAT_STATUSES,
  type HeartbeatDashboardResponse,
} from "@/lib/admin/heartbeat-telemetry";

const inputClass =
  "h-9 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const refresh = () => {
    if (query.offset || query.until) setQuery({ ...query, offset: 0, until: "" });
    else void mutate();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Multiagent heartbeats</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Observed heartbeat polls across all accounts. Best-effort telemetry; snapshot contents and
          account identifiers are excluded.
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
      {data ? (
        <>
          <HeartbeatSummary data={data} />
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
                      <th scope="col" key={label} className="px-3 py-2 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/40 align-top last:border-0">
                      <td className="whitespace-nowrap px-3 py-2">
                        {new Date(run.started_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{run.status}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {number(run.working_subagent_count)} / {number(run.subagent_count)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {number(run.input_tokens)} / {number(run.output_tokens)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {ms(run.duration_ms)} / {ms(run.evaluation_duration_ms)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {usd(run.cost_usd)}
                      </td>
                      <td className="min-w-48 px-3 py-2">
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
                of {number(data.summary.runs)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={
                  isValidating ||
                  query.offset + HEARTBEAT_PAGE_SIZE >= data.summary.runs ||
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
    </div>
  );
}
