"use client";

import type { MemoryFeedbackRow } from "@/lib/schemas/memory-quality";

import { useEffect, useState } from "react";

import { Button } from "@/components/third-party/ui/button";
import {
  FEEDBACK_CHANGED_EVENT,
  MemoryFeedbackEditor,
} from "@/components/memory/memory-feedback-editor";

export function MemoryFeedbackHistory() {
  const [rows, setRows] = useState<MemoryFeedbackRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);

    window.addEventListener(FEEDBACK_CHANGED_EVENT, refresh);

    return () => window.removeEventListener(FEEDBACK_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    fetch(`/api/memory/feedback?offset=${offset}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load feedback.");
        const data = await response.json();

        if (!controller.signal.aborted) {
          if (data.rows.length === 0 && offset > 0) {
            setOffset(Math.max(0, offset - 20));

            return;
          }
          setRows(data.rows);
          setHasMore(data.hasMore);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load feedback. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [offset, version]);

  return (
    <section aria-labelledby="feedback-history-title" className="space-y-3">
      <h3 className="text-base font-medium" id="feedback-history-title">
        Your memory feedback
      </h3>
      <p className="max-w-xl text-sm text-muted-foreground">
        Manage your votes, shared notes, and shared memory copies here, including feedback for
        memories you’ve deleted. Deleting a memory keeps its feedback until you remove it here.
      </p>
      {error && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setVersion((value) => value + 1)}>
            Retry
          </Button>
        </div>
      )}
      {loading && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading feedback…
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      )}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {row.signal === "up" ? "Thumbs up" : "Thumbs down"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Memory {row.memory_id.slice(0, 8)} ·{" "}
                  {new Date(row.updated_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(editing === row.id ? null : row.id);
                  if (editing !== row.id) setVersion((value) => value + 1);
                }}
              >
                {editing === row.id ? "Close" : "Manage"}
              </Button>
            </div>
            {editing === row.id ? (
              <div className="mt-3 max-w-lg">
                <MemoryFeedbackEditor
                  key={`${row.id}:${row.signal}:${row.note_approved_at ?? ""}`}
                  row={row}
                  onClose={() => setEditing(null)}
                  onSaved={(updated) => {
                    setRows((previous) =>
                      previous.flatMap((item) =>
                        item.id !== row.id ? [item] : updated ? [updated] : []
                      )
                    );
                  }}
                />
              </div>
            ) : (
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <p className="whitespace-pre-wrap">
                  {row.note ??
                    (row.shared_memory ? "No note shared" : "Vote only · no note shared")}
                </p>
                {row.shared_memory && (
                  <p className="text-xs">
                    Memory copy shared with Organic LLM’s admin · Manage to view or remove
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {(offset > 0 || hasMore) && (
        <div className="flex gap-2">
          <Button
            disabled={loading || offset === 0}
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setOffset(offset - 20);
            }}
          >
            Previous
          </Button>
          <Button
            disabled={loading || !hasMore}
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setOffset(offset + 20);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
