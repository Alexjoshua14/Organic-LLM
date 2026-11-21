"use client";

import type { RipplePreviewBlock } from "@/lib/schemas/gen-ui";

import { useEffect, useMemo, useRef, useState } from "react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

const KIND_TONE: Record<RipplePreviewBlock["ripples"][number]["kind"], string> = {
  blocked: "bg-accent-warm",
  stale: "bg-muted-foreground/50",
  update: "bg-accent",
  warning: "bg-accent-warm/70",
  info: "bg-muted-foreground/35",
};

type RipplePreviewProps = {
  block: RipplePreviewBlock;
  partial?: boolean;
  /** Host applies only the approved ripple ids (plus the staged change). */
  onApply?: (approvedIds: string[]) => void | Promise<void>;
};

export function RipplePreview({ block, onApply }: RipplePreviewProps) {
  const [approved, setApproved] = useState(() =>
    Object.fromEntries(block.ripples.map((r) => [r.id, r.approved]))
  );
  const [status, setStatus] = useState<"ready" | "applying" | "applied" | "dismissed" | "error">(
    "ready"
  );
  const inFlight = useRef(false);

  useEffect(() => {
    setApproved(Object.fromEntries(block.ripples.map((r) => [r.id, r.approved])));
    setStatus("ready");
  }, [block.ripples]);

  const approvedIds = useMemo(
    () => block.ripples.filter((r) => approved[r.id]).map((r) => r.id),
    [block.ripples, approved]
  );

  const apply = async () => {
    if (!onApply || status !== "ready" || inFlight.current) return;
    inFlight.current = true;
    setStatus("applying");
    try {
      await onApply(approvedIds);
      setStatus("applied");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  };

  if (status === "dismissed") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Ripple dismissed. No changes applied.
      </p>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      <div className="rounded-xl bg-muted/40 p-inset-md">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Staged change</p>
        <p className="text-sm text-foreground">{block.change.summary}</p>
        {block.change.detail ? (
          <p className="mt-stack-xs text-xs text-muted-foreground">{block.change.detail}</p>
        ) : null}
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul className={spacing.card.blockItems} role="list">
        {block.ripples.map((ripple) => {
          const on = Boolean(approved[ripple.id]);

          return (
            <li key={ripple.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setApproved((prev) => ({ ...prev, [ripple.id]: !prev[ripple.id] }))}
                className={cn(
                  "flex w-full items-start gap-inline-md rounded-xl p-inset-md text-left",
                  on ? "bg-muted/40" : "bg-muted/20 opacity-70",
                  FOCUS
                )}
              >
                <span
                  className={cn("mt-stack-xs size-2.5 shrink-0 rounded-full", KIND_TONE[ripple.kind])}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{ripple.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {ripple.kind}
                    {on ? "" : " · skipped"}
                  </span>
                  {ripple.detail ? (
                    <span className="mt-stack-xs block text-xs text-muted-foreground">{ripple.detail}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div role="status" className="text-sm text-muted-foreground">
        {status === "applying" ? "Applying…" : null}
        {status === "applied" ? "Applied." : null}
        {status === "error" ? "Couldn’t confirm the result. Review before retrying." : null}
        {status === "ready" && !onApply
          ? "Preview only. No changes will be written."
          : null}
        {status === "ready" && onApply
          ? `${approvedIds.length} of ${block.ripples.length} ripples selected.`
          : null}
      </div>

      {status === "ready" ? (
        <div className="flex flex-wrap gap-inline-sm">
          {onApply ? (
            <button
              type="button"
              onClick={() => void apply()}
              className={cn(
                "min-h-11 rounded-lg bg-accent-warm px-inset-md text-sm font-medium text-accent-foreground",
                FOCUS
              )}
            >
              Apply approved
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setStatus("dismissed")}
            className={cn(
              "min-h-11 rounded-lg border border-border/60 px-inset-md text-sm text-muted-foreground",
              FOCUS
            )}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
