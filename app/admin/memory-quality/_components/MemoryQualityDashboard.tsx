"use client";

import type { MemoryFeedbackRow, MemoryQualityDailyRow } from "@/lib/schemas/memory-quality";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";

import { cn } from "@/lib/utils";

type MemoryQualityDashboardData = {
  daily: MemoryQualityDailyRow[];
  feedback: Pick<
    MemoryFeedbackRow,
    | "id"
    | "signal"
    | "source"
    | "note"
    | "note_approved_at"
    | "shared_memory"
    | "memory_shared_at"
    | "created_at"
    | "updated_at"
  >[];
  feedbackCounts: { up: number; down: number };
  feedbackHasMore: boolean;
  lastEval?: {
    mode: string;
    total: number;
    passed: number;
    failed: number;
    avgCharCount: number;
    at: string;
  } | null;
};

export function MemoryQualityDashboard() {
  const [data, setData] = useState<MemoryQualityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [evalRunning, setEvalRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/memory-quality?offset=${offset}`, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = (await res.json()) as MemoryQualityDashboardData;

      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const runLiveEval = useCallback(async () => {
    setEvalRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/memory-ingest-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
      const evalJson = await res.json();

      setData((prev) =>
        prev
          ? {
              ...prev,
              lastEval: {
                mode: evalJson.mode,
                total: evalJson.total,
                passed: evalJson.passed,
                failed: evalJson.failed,
                avgCharCount: evalJson.avgCharCount,
                at: evalJson.at,
              },
            }
          : prev
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eval failed");
    } finally {
      setEvalRunning(false);
    }
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading memory quality metrics…
      </div>
    );
  }

  const allDaily = (data?.daily ?? []).filter((d) => d.source === "all");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Memory quality</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your ingest trends and eval runs, plus current votes, approved notes, and explicitly
            shared memory copies across all users.
          </p>
        </div>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm",
            "hover:bg-muted/50 transition-colors disabled:opacity-50"
          )}
          disabled={evalRunning}
          type="button"
          onClick={() => void runLiveEval()}
        >
          {evalRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run eval (dry)
        </button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Current voluntary votes · all users</h3>
        <p className="text-sm tabular-nums">
          {data?.feedbackCounts.up ?? 0} thumbs up · {data?.feedbackCounts.down ?? 0} thumbs down
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          One current vote per memory. People may be more likely to report bad memories than good
          ones. These counts describe submitted feedback; they do not measure overall memory
          accuracy or satisfaction.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Daily trends (all sources)
        </h3>
        {allDaily.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rollup data yet. Ingest or delete a memory to seed events.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Ingests</th>
                  <th className="px-3 py-2">Deletes</th>
                  <th className="px-3 py-2">Delete rate</th>
                  <th className="px-3 py-2">Chars p50</th>
                  <th className="px-3 py-2">Chars p90</th>
                </tr>
              </thead>
              <tbody>
                {allDaily.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 tabular-nums">{row.day}</td>
                    <td className="px-3 py-2 tabular-nums">{row.ingest_count}</td>
                    <td className="px-3 py-2 tabular-nums">{row.delete_count}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.delete_rate != null ? `${(row.delete_rate * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.char_count_p50 ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.char_count_p90 ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Feedback · all users
        </h3>
        {(data?.feedback ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {(data?.feedback ?? []).slice(0, 20).map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-border px-3 py-2 text-sm flex flex-wrap gap-x-3 gap-y-1"
              >
                <span className="font-medium">{f.signal}</span>
                <span className="text-muted-foreground">{f.source}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(f.updated_at).toLocaleString()}
                </span>
                <p className="w-full whitespace-pre-wrap text-sm">
                  {f.note ??
                    (f.shared_memory ? "No note approved" : "Vote only · no note approved")}
                </p>
                {f.shared_memory && (
                  <details className="w-full rounded-lg bg-muted/40 p-3">
                    <summary className="cursor-pointer text-xs font-medium">
                      Memory copy shared by the user
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {f.shared_memory}
                    </p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-3 text-sm">
          <button
            disabled={loading || offset === 0}
            type="button"
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Previous
          </button>
          <button
            disabled={loading || !data?.feedbackHasMore}
            type="button"
            onClick={() => setOffset(offset + 20)}
          >
            Next
          </button>
        </div>
      </section>

      {data?.lastEval ? (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Last eval run
          </h3>
          <p className="text-sm">
            {data.lastEval.passed}/{data.lastEval.total} passed · avg {data.lastEval.avgCharCount}{" "}
            chars · {data.lastEval.mode} · {new Date(data.lastEval.at).toLocaleString()}
          </p>
        </section>
      ) : null}
    </div>
  );
}
