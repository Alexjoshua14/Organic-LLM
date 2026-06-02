"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { StatusCheckCardList } from "@/components/status/status-check-card";
import { StatusCheckTable } from "@/components/status/status-check-table";
import { StatusHero } from "@/components/status/status-hero";
import { Button } from "@/components/third-party/ui/button";
import { Switch } from "@/components/third-party/ui/switch";
import { glass } from "@/components/design-system/primitives";
import type { HealthReport } from "@/lib/health/client-types";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_MS = 30_000;

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

export default function StatusPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/status?deep=1", { cache: "no-store" });
      if (res.status === 401) {
        setError("Sign in to view system status.");
        setReport(null);
        return;
      }
      if (res.status === 403) {
        setError("You do not have access to this page.");
        setReport(null);
        return;
      }
      if (!res.ok) {
        setError(`Status check failed (${res.status})`);
        setReport(null);
        return;
      }
      const data = (await res.json()) as HealthReport;
      setReport(data);
    } catch {
      setError("Could not reach the status API.");
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void fetchStatus(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, fetchStatus]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <Page transparentBackground className="!items-stretch !justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
          "pb-[max(1rem,env(safe-area-inset-bottom))]"
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-3xl flex-1 flex-col lg:max-w-4xl",
            "pl-20 pr-4 pt-[max(3.25rem,calc(0.75rem+env(safe-area-inset-top)))]",
            "md:pl-10 md:pr-10 md:pt-12 lg:px-12 lg:pt-14"
          )}
        >
          <header className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 select-none md:mb-6 md:gap-3 md:pb-4">
            <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
              <Link
                aria-label="Back to home"
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
                href="/"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="font-commissioner text-xl font-light tracking-tight text-foreground sm:text-2xl md:text-[1.75rem] md:leading-tight lg:text-3xl">
                System status
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {report ? (
                <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline md:text-xs">
                  Updated {formatRelativeTime(report.checkedAt)}
                </span>
              ) : null}
              <Button
                className="h-7 gap-1 px-2 text-[11px] [&_svg]:size-3"
                disabled={loading || refreshing}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void fetchStatus(true)}
              >
                {refreshing ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <RefreshCw aria-hidden />
                )}
                Refresh
              </Button>

              <label className="hidden h-8 items-center gap-1.5 sm:flex">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <span className="text-[11px] text-muted-foreground">Auto 30s</span>
              </label>

              <div className="relative sm:hidden" ref={menuRef}>
                <Button
                  aria-expanded={menuOpen}
                  aria-label="More options"
                  className="size-8"
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
                {menuOpen ? (
                  <div
                    className={cn(
                      glass({ opaque: true }),
                      "absolute right-0 top-full z-30 mt-1 min-w-[9rem] rounded-lg border border-border p-2 shadow-lg"
                    )}
                  >
                    <label className="flex h-8 items-center justify-between gap-2 text-xs">
                      <span>Auto 30s</span>
                      <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                    </label>
                    {report ? (
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        Updated {formatRelativeTime(report.checkedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="flex-1 pb-6 md:pb-10 lg:pb-12">
          {error ? (
            <div
              className={cn(
                glass({ opaque: true }),
                "select-none rounded-2xl border border-destructive/30 px-4 py-6 text-center"
              )}
            >
              <p className="text-sm text-destructive">
                <span className="select-text">{error}</span>
              </p>
              <Button className="mt-4" type="button" variant="secondary" onClick={() => void fetchStatus()}>
                Retry
              </Button>
              {!error.includes("access") ? null : (
                <p className="mt-3 text-xs text-muted-foreground">
                  <Link className="underline" href="/">
                    Return home
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "space-y-2.5 motion-reduce:transition-none md:space-y-6",
                refreshing && "pointer-events-none opacity-60"
              )}
            >
              <StatusHero loading={loading && !report} report={report} />

              {loading && !report ? (
                <div className="space-y-1.5 select-none md:hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-xl bg-muted/40" />
                  ))}
                </div>
              ) : null}
              {loading && !report ? (
                <div className="hidden h-44 animate-pulse rounded-2xl bg-muted/40 select-none md:block" />
              ) : null}

              {report ? (
                <>
                  <StatusCheckCardList checks={report.checks} />
                  <StatusCheckTable checks={report.checks} />
                </>
              ) : null}
            </div>
          )}
          </div>
        </div>
      </div>
    </Page>
  );
}
