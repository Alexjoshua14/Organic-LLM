"use client";

import { useEffect, useState } from "react";

import { UsageLedgerDashboard } from "./UsageLedgerDashboard";

import { Button } from "@/components/third-party/ui/button";
import { UsageStatCard } from "@/components/usage/usage-stat-card";
import { UsageSectionHeader } from "@/components/usage/usage-section-header";
import { spacing } from "@/lib/design-tokens/spacing";
import { formatTokenCount } from "@/lib/usage/format";
import {
  cacheRate,
  groupTokens,
  surfaceLabel,
  tokenTotals,
  type TokenAnalytics,
  type TokenTotals,
} from "@/lib/usage/token-analytics";

const percent = (value: number | null) => (value === null ? "N/A" : `${(value * 100).toFixed(1)}%`);
const fills = ["bg-lumen", "bg-foreground/40", "bg-muted-foreground/20"];

function TokenBar({ row, maximum }: { row: TokenTotals; maximum: number }) {
  return (
    <div className="flex h-5 w-full overflow-hidden rounded-sm bg-muted/20" aria-hidden>
      {[row.cached, row.uncached, row.unknown].map((value, index) => (
        <span
          key={index}
          className={fills[index]}
          style={{
            width: `${maximum > 0 ? (value / maximum) * 100 : 0}%`,
            ...(index === 2
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)",
                  color: "var(--border)",
                }
              : {}),
          }}
        />
      ))}
    </div>
  );
}
function description(row: TokenTotals) {
  return `${formatTokenCount(row.cached)} cached, ${formatTokenCount(row.uncached)} uncached, ${formatTokenCount(row.unknown)} unknown input tokens; ${percent(cacheRate(row))} cached among reported input`;
}

export function TokenAnalyticsDashboard({ ownerId }: { ownerId: string }) {
  const [tab, setTab] = useState("analytics");
  const [days, setDays] = useState("30");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<TokenAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState("");
  const [model, setModel] = useState("");
  const [volume, setVolume] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    setData(null);
    setError(null);
    fetch(`/api/admin/token-analytics?days=${days}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) throw new Error(result.error ?? "Analytics unavailable");
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Analytics unavailable");
      });

    return () => controller.abort();
  }, [days, refresh]);
  const rows =
    data?.rows.filter(
      (row) => (!surface || row.surface === surface) && (!model || row.model === model)
    ) ?? [];
  const totals = tokenTotals(rows);
  const surfaces = groupTokens(
    data?.rows.filter((row) => !model || row.model === model) ?? [],
    "surface"
  ).sort((a, b) => b.input - a.input);
  const daily = groupTokens(rows, "day");
  const allDays = data
    ? Array.from({ length: Number(days) }, (_, i) => {
        const date = new Date(data.start);

        date.setUTCDate(date.getUTCDate() + i);
        const key = date.toISOString().slice(0, 10);

        return { key, ...tokenTotals(daily.filter((row) => row.key === key)) };
      })
    : [];
  const dailyMax = Math.max(1, ...allDays.map((row) => row.input));

  return (
    <div className={spacing.card.section}>
      <div className="flex gap-2" aria-label="Usage views">
        <Button
          variant={tab === "analytics" ? "secondary" : "ghost"}
          onClick={() => setTab("analytics")}
        >
          Analytics
        </Button>
        <Button variant={tab === "ledger" ? "secondary" : "ghost"} onClick={() => setTab("ledger")}>
          Ledger
        </Button>
      </div>
      {tab === "ledger" ? (
        <UsageLedgerDashboard initialOwnerId={ownerId} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Token usage</h2>
              <p className="text-xs text-muted-foreground">
                My usage · UTC ·{" "}
                {data ? `Updated ${new Date(data.end).toLocaleTimeString()}` : "Loading telemetry"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label>
                Range{" "}
                <select
                  className="rounded border border-border bg-background p-2"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                >
                  {[7, 30, 90].map((n) => (
                    <option key={n} value={n}>
                      {n} days
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Surface{" "}
                <select
                  className="max-w-40 rounded border border-border bg-background p-2"
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                >
                  <option value="">All surfaces</option>
                  {Array.from(new Set(data?.rows.map((row) => row.surface))).map((key) => (
                    <option key={key} value={key}>
                      {surfaceLabel(key)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Model{" "}
                <select
                  className="max-w-48 rounded border border-border bg-background p-2"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">All models</option>
                  {Array.from(new Set(data?.rows.map((row) => row.model))).map((key) => (
                    <option key={key}>{key}</option>
                  ))}
                </select>
              </label>
              <Button size="sm" variant="ghost" onClick={() => setRefresh((n) => n + 1)}>
                Refresh
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <UsageStatCard
                  label="Cached input · reported"
                  value={data ? percent(cacheRate(totals)) : undefined}
                  accent
                />
                <UsageStatCard
                  label="Input tokens"
                  value={data ? formatTokenCount(totals.input) : undefined}
                />
                <UsageStatCard
                  label="Uncached · reported"
                  value={data ? formatTokenCount(totals.uncached) : undefined}
                />
                <UsageStatCard
                  label="Cache telemetry coverage"
                  value={
                    data
                      ? percent(
                          totals.input ? (totals.cached + totals.uncached) / totals.input : null
                        )
                      : undefined
                  }
                />
              </div>
              {!data ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading token charts…
                </p>
              ) : data.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded usage in this range.</p>
              ) : (
                <>
                  <section className={spacing.card.block}>
                    <UsageSectionHeader
                      title="Input by surface"
                      caption="Cached / uncached / unknown. Select a surface to inspect it below."
                      aside={
                        <Button size="sm" variant="ghost" onClick={() => setVolume((v) => !v)}>
                          {volume ? "Token volume" : "Percentage"}
                        </Button>
                      }
                    />
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {["Cached", "Uncached", "Unknown / legacy"].map((label, i) => (
                        <span key={label} className="flex items-center gap-2">
                          <span className={`h-2 w-3 ${fills[i]}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                    {surfaces.map((row) => (
                      <button
                        key={row.key}
                        aria-pressed={surface === row.key}
                        onClick={() => setSurface(surface === row.key ? "" : row.key)}
                        className="grid w-full grid-cols-[7rem_1fr] items-center gap-3 rounded-lg border border-border/50 p-3 text-left focus-visible:outline-2 focus-visible:outline-lumen sm:grid-cols-[8rem_1fr_7rem]"
                        aria-label={`${surfaceLabel(row.key)}: ${description(row)}`}
                      >
                        <span className="text-xs font-medium">{surfaceLabel(row.key)}</span>
                        <TokenBar
                          row={row}
                          maximum={
                            volume ? Math.max(1, ...surfaces.map((s) => s.input)) : row.input
                          }
                        />
                        <span className="col-start-2 text-xs tabular-nums text-muted-foreground sm:col-start-auto">
                          {formatTokenCount(row.input)} · {percent(cacheRate(row))}
                        </span>
                      </button>
                    ))}
                  </section>
                  <section className={spacing.card.block}>
                    <UsageSectionHeader
                      title="Daily input volume"
                      caption="UTC days · focus a bar for counts and cache rate"
                    />
                    <div className="flex h-48 items-end gap-1 rounded-xl border border-border/50 bg-muted/15 p-3">
                      {allDays.map((row) => (
                        <button
                          key={row.key}
                          className="group relative flex h-full min-w-0 flex-1 flex-col justify-end focus-visible:outline-2 focus-visible:outline-lumen"
                          aria-label={`${row.key}: ${description(row)}`}
                          title={`${row.key}: ${description(row)}`}
                        >
                          <span
                            className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm"
                            style={{ height: `${(row.input / dailyMax) * 100}%` }}
                          >
                            {[row.cached, row.uncached, row.unknown].map((value, i) => (
                              <span
                                key={i}
                                className={fills[i]}
                                style={{ height: `${row.input ? (value / row.input) * 100 : 0}%` }}
                              />
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{allDays[0]?.key}</span>
                      <span>Peak {formatTokenCount(dailyMax)} input tokens</span>
                      <span>{allDays.at(-1)?.key}</span>
                    </div>
                  </section>
                  <section className={spacing.card.block}>
                    <UsageSectionHeader
                      title="Daily cache rate"
                      caption="Share of reported input · gaps mean no reported input"
                    />
                    <div
                      className="flex h-24 items-end gap-1 border-b border-border"
                      aria-label="Daily cache percentage, zero to 100 percent"
                    >
                      {allDays.map((row) => (
                        <div
                          key={row.key}
                          className="flex h-full min-w-0 flex-1 items-end"
                          title={`${row.key}: ${percent(cacheRate(row))}`}
                        >
                          <span
                            className="w-full rounded-t-sm bg-lumen"
                            style={{ height: `${(cacheRate(row) ?? 0) * 100}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {(["model", "operation"] as const).map((dimension) => (
                      <section key={dimension} className={spacing.card.block}>
                        <UsageSectionHeader
                          title={dimension === "model" ? "Models" : "Operations"}
                          caption={surface ? surfaceLabel(surface) : "All selected usage"}
                        />
                        {groupTokens(rows, dimension)
                          .sort((a, b) => b.input - a.input)
                          .map((row) => (
                            <div key={row.key} className={spacing.card.labelStack}>
                              <p className="flex justify-between gap-3 text-xs">
                                <span className="break-all">{row.key}</span>
                                <span className="shrink-0 tabular-nums">
                                  {percent(cacheRate(row))} · {formatTokenCount(row.input)}
                                </span>
                              </p>
                              <div role="img" aria-label={description(row)}>
                                <TokenBar row={row} maximum={row.input} />
                              </div>
                            </div>
                          ))}
                      </section>
                    ))}
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Daily values and measurement details
                    </summary>
                    <div className="overflow-x-auto">
                      <table className="mt-3 w-full text-left tabular-nums">
                        <caption className="text-left text-muted-foreground">
                          Cache percentages use reported input only. Historical and missing cache
                          counts are unknown. Output is separate: {formatTokenCount(totals.output)}{" "}
                          tokens. {totals.calls} recorded calls.
                        </caption>
                        <thead>
                          <tr>
                            {["UTC day", "Cached", "Uncached", "Unknown", "Cache rate"].map(
                              (label) => (
                                <th key={label} className="p-2">
                                  {label}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {allDays.map((row) => (
                            <tr key={row.key}>
                              <th className="p-2 font-normal">{row.key}</th>
                              {[row.cached, row.uncached, row.unknown].map((n, i) => (
                                <td key={i} className="p-2">
                                  {n.toLocaleString()}
                                </td>
                              ))}
                              <td className="p-2">{percent(cacheRate(row))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
