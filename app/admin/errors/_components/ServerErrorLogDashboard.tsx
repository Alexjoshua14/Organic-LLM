"use client";

import type { ServerErrorLogSource, ServerErrorReport } from "@/lib/observability/server-error";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { cn } from "@/lib/utils";

type ErrorLogResponse = {
  reports: ServerErrorReport[];
  source: ServerErrorLogSource;
  redisConfigured: boolean;
  limit: number;
  logTag: string;
};

const ALL_ROUTES = "__all__";

function relativeTime(iso: string): string {
  const then = Date.parse(iso);

  if (!Number.isFinite(then)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;

  return `${Math.round(seconds / 86400)}d ago`;
}

function ReportCard({ report }: { report: ServerErrorReport }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyTextToClipboard(JSON.stringify(report, null, 2))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-2xs text-destructive">
          {report.stage}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">{report.route}</span>
        <span className="font-mono text-2xs text-muted-foreground">HTTP {report.status}</span>
        <span className="ml-auto text-2xs text-muted-foreground" title={report.at}>
          {relativeTime(report.at)}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium break-words">
        {report.name}: {report.message}
      </p>

      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-2xs sm:grid-cols-2">
        <Detail label="Error id" value={report.errorId} />
        {report.code ? <Detail label="Code" value={report.code} /> : null}
        {report.statusCode ? <Detail label="Upstream" value={String(report.statusCode)} /> : null}
        {report.url ? <Detail label="URL" value={report.url} /> : null}
        {report.cause ? <Detail label="Cause" value={report.cause} /> : null}
      </dl>

      {report.context ? (
        <p className="mt-2 font-mono text-2xs break-all text-muted-foreground">
          {JSON.stringify(report.context)}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-3">
        <button
          className="text-2xs text-muted-foreground transition-colors hover:text-foreground"
          type="button"
          onClick={copy}
        >
          {copied ? "Copied" : "Copy JSON"}
        </button>
        {report.stack || report.responseBody ? (
          <details className="flex-1">
            <summary className="cursor-pointer text-2xs text-muted-foreground hover:text-foreground">
              Stack / response body
            </summary>
            <pre className="mt-1 max-h-72 overflow-auto rounded bg-background p-2 text-2xs leading-relaxed break-all whitespace-pre-wrap">
              {[report.stack, report.responseBody].filter(Boolean).join("\n\n---\n\n")}
            </pre>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="min-w-0 font-mono break-all">{value}</dd>
    </div>
  );
}

/**
 * Recent server errors, newest first. Backed by the Upstash ring buffer when it is
 * configured; otherwise the in-process fallback, which only shows failures from the
 * instance serving this request.
 */
export function ServerErrorLogDashboard() {
  const [data, setData] = useState<ErrorLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<string>(ALL_ROUTES);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/errors");

      if (!res.ok) {
        throw new Error(await res.text());
      }
      setData((await res.json()) as ErrorLogResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clear = useCallback(async () => {
    await fetch("/api/admin/errors", { method: "DELETE" });
    void load();
  }, [load]);

  const routes = useMemo(() => {
    const set = new Set((data?.reports ?? []).map((r) => r.route));

    return Array.from(set).sort();
  }, [data]);

  const reports = useMemo(() => {
    const all = data?.reports ?? [];

    return routeFilter === ALL_ROUTES ? all : all.filter((r) => r.route === routeFilter);
  }, [data, routeFilter]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-medium">Recent server errors</h2>
          <p className="text-2xs text-muted-foreground">
            {data
              ? `${data.reports.length} recorded · source: ${data.source}${
                  data.redisConfigured ? "" : " (Upstash not configured — this instance only)"
                }`
              : "Loading…"}
          </p>
        </div>

        {routes.length > 1 ? (
          <select
            aria-label="Filter by route"
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
          >
            <option value={ALL_ROUTES}>All routes</option>
            {routes.map((route) => (
              <option key={route} value={route}>
                {route}
              </option>
            ))}
          </select>
        ) : null}

        <button
          className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
          disabled={loading}
          type="button"
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </button>
        <button
          className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
          type="button"
          onClick={() => void clear()}
        >
          <Trash2 className="size-3.5" />
          Clear
        </button>
      </header>

      {data ? (
        <p className="text-2xs text-muted-foreground">
          Every entry is also printed to the server log as one JSON line tagged{" "}
          <span className="font-mono">{data.logTag}</span> — grep for that (or for an error id) in
          your hosting provider&apos;s logs.
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && reports.length === 0 && !error ? (
        <p
          className={cn(
            "rounded border border-border p-6 text-center text-xs text-muted-foreground"
          )}
        >
          No errors recorded.
        </p>
      ) : null}

      <ul className="space-y-2">
        {reports.map((report) => (
          <ReportCard key={`${report.errorId}-${report.at}`} report={report} />
        ))}
      </ul>
    </section>
  );
}
