"use client";

import type { ContinuitySelection, ContinuitySource } from "@/lib/continuity/schema";

import { useRef, useState } from "react";

type Candidate = { source: ContinuitySource; label: string; at: string | null };
async function request(path: string, body?: unknown) {
  const res = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" }
  );
  const data = await res.json();

  if (!res.ok) throw new Error(data.error ?? "Context unavailable");

  return data;
}
/** Explicit source context only. Does not open a call, move transcripts or restore a workspace. */
export function ContextPicker({
  surface,
  compact = false,
  disabled = false,
  onChange,
}: {
  surface: "speak" | "stage";
  compact?: boolean;
  disabled?: boolean;
  onChange: (selection: ContinuitySelection | undefined) => void;
}) {
  const [kind, setKind] = useState<"speak-thread" | "stage-artifact">("speak-thread");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [coverage, setCoverage] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const interaction = useRef<ContinuitySelection | undefined>(undefined);
  const details = useRef<HTMLDetailsElement>(null);
  const pending = useRef(false);

  async function search(page = 0) {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request(
        `/api/continuity?${new URLSearchParams({ kind, query, page: String(page) })}`
      );

      setCandidates(data.candidates);
      setNextPage(data.nextPage);
      setCoverage(data.coverage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search unavailable");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function select(candidate: Candidate | null) {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      // A clear also updates the server, invalidating stale revisions. No page-visit write.
      if (!interaction.current)
        interaction.current = await request("/api/continuity", { action: "create", surface });
      const current = interaction.current!;
      const result = await request("/api/continuity", {
        action: "select",
        interactionId: current.interactionId,
        expectedRevision: current.revision,
        requestId: crypto.randomUUID(),
        source: candidate?.source ?? null,
      });

      interaction.current = { interactionId: result.interactionId, revision: result.revision };
      onChange(candidate ? interaction.current : undefined);
      setLabel(candidate?.label ?? null);
      if (details.current) details.current.open = false;
    } catch (cause) {
      // Require explicit reselection after expiry/conflict. Never fall back to another topic.
      interaction.current = undefined;
      onChange(undefined);
      setLabel(null);
      setError(cause instanceof Error ? cause.message : "Selection unavailable");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <details ref={details} className="relative text-sm">
      <summary
        aria-disabled={disabled}
        className="flex min-h-11 max-w-64 cursor-pointer items-center rounded-xl px-inset-md text-muted-foreground hover:text-foreground"
      >
        <span className="truncate">
          {compact
            ? label
              ? "Context added"
              : "Context"
            : label
              ? `Added context: ${label}`
              : "Add previous context"}
        </span>
      </summary>
      <div className="fixed inset-x-4 top-20 z-50 mx-auto max-h-[65dvh] max-w-sm overflow-y-auto rounded-xl border border-border bg-background p-inset-md shadow-xl">
        <p className="mb-stack-sm text-xs text-muted-foreground">
          Adds reference material. Your current conversation and Stage stay in place.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
          className="flex flex-col gap-stack-sm"
        >
          <label>
            Search in
            <select
              aria-label="Context source"
              className="block min-h-11 w-full rounded-lg border border-border bg-background px-inset-sm"
              disabled={disabled || busy}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as typeof kind);
                setCandidates([]);
                setNextPage(null);
              }}
            >
              <option value="speak-thread">Voice conversations</option>
              <option value="stage-artifact">Current Stage pieces</option>
            </select>
          </label>
          <label>
            Title
            <input
              className="block min-h-11 w-full rounded-lg border border-border bg-background px-inset-sm text-base"
              disabled={disabled || busy}
              maxLength={200}
              value={query}
              placeholder="e.g. Aion architecture"
              onChange={(event) => {
                setQuery(event.target.value);
                setCandidates([]);
                setNextPage(null);
              }}
            />
          </label>
          <button
            className="min-h-11 rounded-lg bg-secondary px-inset-md"
            disabled={disabled || busy}
            type="submit"
          >
            {busy ? "Working…" : "Find context"}
          </button>
        </form>
        <p className="my-stack-sm text-xs text-muted-foreground">{coverage}</p>
        <ul>
          {candidates.map((candidate) => (
            <li key={JSON.stringify(candidate.source)}>
              <button
                className="flex min-h-11 w-full flex-col items-start rounded-lg p-inset-sm text-left hover:bg-secondary"
                disabled={disabled || busy}
                onClick={() => void select(candidate)}
                type="button"
              >
                <span>{candidate.label}</span>
                <span className="text-xs text-muted-foreground">
                  {candidate.at ? new Date(candidate.at).toLocaleString() : "Current Stage"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {nextPage !== null ? (
          <button
            disabled={disabled || busy}
            className="min-h-11 px-inset-sm"
            onClick={() => void search(nextPage)}
            type="button"
          >
            More results
          </button>
        ) : null}
        {label ? (
          <button
            disabled={disabled || busy}
            className="min-h-11 px-inset-sm"
            onClick={() => void select(null)}
            type="button"
          >
            Remove added context
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {disabled ? (
          <p className="text-xs text-muted-foreground">
            End the call or wait for the current turn before changing context.
          </p>
        ) : null}
      </div>
    </details>
  );
}
