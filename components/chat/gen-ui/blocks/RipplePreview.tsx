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

type RippleKind = RipplePreviewBlock["ripples"][number]["kind"];

/** Same tones as KIND_TONE, as text colour so SVG strokes and fills pick them up. */
const KIND_TEXT: Record<RippleKind, string> = {
  blocked: "text-accent-warm",
  stale: "text-muted-foreground/50",
  update: "text-accent",
  warning: "text-accent-warm/70",
  info: "text-muted-foreground/35",
};

/** Inner ring first: the effects that most need a look sit closest to the change. */
const KIND_ORDER: RippleKind[] = ["blocked", "warning", "update", "stale", "info"];

/* Ripple map geometry, in the SVG's own viewBox units (scaled by the size class). */
const MAP_VIEW = 96;
const MAP_CENTER = MAP_VIEW / 2;
const MAP_CORE_R = 7;
const MAP_INNER_R = 16;
const MAP_OUTER_R = 43;
const MAP_DOT_R = 3.5;

type RippleRing = { kind: RippleKind; r: number; ripples: RipplePreviewBlock["ripples"] };

function rippleRings(ripples: RipplePreviewBlock["ripples"]): RippleRing[] {
  const kinds = KIND_ORDER.filter((kind) => ripples.some((r) => r.kind === kind));
  const step = (MAP_OUTER_R - MAP_INNER_R) / Math.max(kinds.length, 1);

  return kinds.map((kind, i) => ({
    kind,
    r: MAP_INNER_R + step * (i + 1),
    ripples: ripples.filter((r) => r.kind === kind),
  }));
}

/** The change at the centre, one ring per kind of effect, one dot per effect (hollow when skipped). */
function RippleMap({
  rings,
  approved,
  label,
}: {
  rings: RippleRing[];
  approved: Record<string, boolean | undefined>;
  label: string;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      className="size-24 shrink-0"
      focusable="false"
      viewBox={`0 0 ${MAP_VIEW} ${MAP_VIEW}`}
    >
      {rings.map((ring) => (
        <circle
          key={`ring-${ring.kind}`}
          className={KIND_TEXT[ring.kind]}
          cx={MAP_CENTER}
          cy={MAP_CENTER}
          fill="none"
          r={ring.r}
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      ))}
      {rings.map((ring, ringIndex) =>
        ring.ripples.map((ripple, i) => {
          // Stagger each ring's start so dots on neighbouring rings do not line up.
          const angle = (i / ring.ripples.length) * 2 * Math.PI - Math.PI / 2 + ringIndex * 0.7;
          const on = Boolean(approved[ripple.id]);

          return (
            <circle
              key={ripple.id}
              className={KIND_TEXT[ring.kind]}
              cx={MAP_CENTER + ring.r * Math.cos(angle)}
              cy={MAP_CENTER + ring.r * Math.sin(angle)}
              fill={on ? "currentColor" : "none"}
              r={MAP_DOT_R}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          );
        })
      )}
      <circle
        className="text-foreground"
        cx={MAP_CENTER}
        cy={MAP_CENTER}
        fill="currentColor"
        r={MAP_CORE_R}
      />
    </svg>
  );
}

type RipplePreviewProps = {
  block: RipplePreviewBlock;
  partial?: boolean;
  /** Host applies only the approved ripple ids (plus the staged change). */
  onApply?: (approvedIds: string[]) => void | Promise<void>;
  /** Ripple map (change at the centre, effects on rings by kind) with counts; Apply stays visible. */
  condensed?: boolean;
};

export function RipplePreview({ block, onApply, condensed = false }: RipplePreviewProps) {
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

  if (condensed) {
    const rings = rippleRings(block.ripples);
    const mapLabel = `Ripple map: ${block.change.summary}, with ${rings
      .map((ring) => `${ring.ripples.length} ${ring.kind}`)
      .join(", ")}. ${approvedIds.length} of ${block.ripples.length} effects selected.`;

    return (
      <section className="mx-auto w-full max-w-sm space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
        <h3 className="truncate text-sm font-medium text-foreground">{block.title}</h3>

        <div className="flex items-center gap-inline-md">
          <RippleMap rings={rings} approved={approved} label={mapLabel} />
          <div className="min-w-0 flex-1 space-y-stack-xs">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Staged change</p>
            <p className="line-clamp-2 text-xs text-foreground">{block.change.summary}</p>
            <ul aria-label="Effects by kind" className="flex flex-wrap gap-inline-xs">
              {rings.map((ring) => (
                <li
                  key={ring.kind}
                  className="flex items-center gap-inline-xs rounded-full bg-muted/50 px-inset-sm py-0.5 font-mono text-2xs text-muted-foreground"
                >
                  <span aria-hidden className={cn("size-2 rounded-full", KIND_TONE[ring.kind])} />
                  <span className="tabular-nums text-foreground">{ring.ripples.length}</span>
                  {ring.kind}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <details>
          <summary className="organic-focus cursor-pointer text-xs text-muted-foreground">
            Review {block.ripples.length} {block.ripples.length === 1 ? "effect" : "effects"} ·{" "}
            {approvedIds.length} selected
          </summary>
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
          <ul className="mt-stack-xs space-y-stack-xs" role="list">
            {block.ripples.map((ripple) => {
              const on = Boolean(approved[ripple.id]);

              return (
                <li key={ripple.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      setApproved((prev) => ({ ...prev, [ripple.id]: !prev[ripple.id] }))
                    }
                    className={cn(
                      "flex min-h-11 w-full items-center gap-inline-sm rounded-xl px-inset-sm text-left",
                      on ? "bg-muted/40" : "bg-muted/20 opacity-70",
                      FOCUS
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        on ? KIND_TONE[ripple.kind] : "border border-border"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {ripple.label}
                    </span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {on ? ripple.kind : "skipped"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>

        <div role="status" className="text-xs text-muted-foreground">
          {status === "applying" ? "Applying…" : null}
          {status === "applied" ? "Applied." : null}
          {status === "error" ? "Couldn’t confirm the result. Review before retrying." : null}
          {status === "ready" && !onApply ? "Preview only. No changes will be written." : null}
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
                Apply {approvedIds.length} approved
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
      </section>
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
