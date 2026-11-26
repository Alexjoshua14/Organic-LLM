"use client";

import type { RipplePreviewBlock } from "@/lib/schemas/gen-ui";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

/** Where each effect's dot sits, in viewBox units. Stagger keeps neighbouring rings' dots apart. */
function dotPositions(rings: RippleRing[]) {
  const at = new Map<string, { x: number; y: number }>();

  rings.forEach((ring, ringIndex) => {
    ring.ripples.forEach((ripple, i) => {
      const angle = (i / ring.ripples.length) * 2 * Math.PI - Math.PI / 2 + ringIndex * 0.7;

      at.set(ripple.id, {
        x: MAP_CENTER + ring.r * Math.cos(angle),
        y: MAP_CENTER + ring.r * Math.sin(angle),
      });
    });
  });

  return at;
}

/**
 * The change at the centre, one ring per kind of effect, one dot per effect (hollow when skipped).
 * Each dot has a tap target laid over it that focuses the effect in the inspector below.
 */
function RippleMap({
  rings,
  approved,
  label,
  focusedId,
  onFocus,
}: {
  rings: RippleRing[];
  approved: Record<string, boolean | undefined>;
  label: string;
  focusedId: string | null;
  onFocus: (id: string) => void;
}) {
  const at = dotPositions(rings);
  const focusedAt = focusedId ? at.get(focusedId) : undefined;

  return (
    <div className="relative size-24 shrink-0">
      <svg
        role="img"
        aria-label={label}
        className="absolute inset-0 size-full"
        focusable="false"
        viewBox={`0 0 ${MAP_VIEW} ${MAP_VIEW}`}
      >
        <RippleMapMarks rings={rings} approved={approved} at={at} />
        {focusedAt ? (
          <circle
            className="text-foreground"
            cx={focusedAt.x}
            cy={focusedAt.y}
            fill="none"
            r={MAP_DOT_R + 2.5}
            stroke="currentColor"
            strokeWidth="1"
          />
        ) : null}
      </svg>
      {rings.flatMap((ring) =>
        ring.ripples.map((ripple) => {
          const p = at.get(ripple.id)!;

          return (
            <button
              key={ripple.id}
              type="button"
              aria-label={`${ripple.kind}: ${ripple.label}`}
              aria-pressed={focusedId === ripple.id}
              onClick={() => onFocus(ripple.id)}
              className="organic-focus absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:bg-foreground/20 focus-visible:outline-none"
              style={{ left: `${(p.x / MAP_VIEW) * 100}%`, top: `${(p.y / MAP_VIEW) * 100}%` }}
            />
          );
        })
      )}
    </div>
  );
}

function RippleMapMarks({
  rings,
  approved,
  at,
}: {
  rings: RippleRing[];
  approved: Record<string, boolean | undefined>;
  at: Map<string, { x: number; y: number }>;
}) {
  return (
    <>
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
      {rings.map((ring) =>
        ring.ripples.map((ripple) => {
          const on = Boolean(approved[ripple.id]);
          const p = at.get(ripple.id)!;

          return (
            <circle
              key={ripple.id}
              className={KIND_TEXT[ring.kind]}
              cx={p.x}
              cy={p.y}
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
    </>
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
  /** Condensed: the effect shown in the inspector (defaults to the most urgent). */
  const [focusId, setFocusId] = useState<string | null>(null);

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
    // Map order (most urgent ring first) is also the inspector's stepping order.
    const ordered = rings.flatMap((ring) => ring.ripples);
    const focused = ordered.find((r) => r.id === focusId) ?? ordered[0] ?? null;
    const mapLabel = `Ripple map: ${block.change.summary}, with ${rings
      .map((ring) => `${ring.ripples.length} ${ring.kind}`)
      .join(", ")}. ${approvedIds.length} of ${block.ripples.length} effects selected.`;

    return (
      <section className="mx-auto w-full max-w-sm space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
        <h3 className="truncate text-sm font-medium text-foreground">{block.title}</h3>

        <div className="flex items-center gap-inline-md">
          <RippleMap
            rings={rings}
            approved={approved}
            label={mapLabel}
            focusedId={focused?.id ?? null}
            onFocus={setFocusId}
          />
          <div className="min-w-0 flex-1 space-y-stack-xs">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Staged change</p>
            <p className="line-clamp-2 text-xs text-foreground">{block.change.summary}</p>
            <ul aria-label="Effects by kind" className="flex flex-wrap gap-inline-xs">
              {rings.map((ring) => {
                const pressed = focused?.kind === ring.kind;

                return (
                  <li key={ring.kind}>
                    <button
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => {
                        // First tap shows the kind's first effect; tapping again steps through it.
                        const i = pressed
                          ? ring.ripples.findIndex((r) => r.id === focused?.id) + 1
                          : 0;

                        setFocusId(ring.ripples[i % ring.ripples.length]!.id);
                      }}
                      className={cn(
                        "flex items-center gap-inline-xs rounded-full border px-inset-sm py-0.5 font-mono text-2xs",
                        pressed
                          ? "border-foreground/40 bg-muted text-foreground"
                          : "border-transparent bg-muted/50 text-muted-foreground",
                        FOCUS
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("size-2 rounded-full", KIND_TONE[ring.kind])}
                      />
                      <span className="tabular-nums text-foreground">{ring.ripples.length}</span>
                      {ring.kind}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Inspector: every effect is rendered in one grid cell and only the focused one is
            visible, so the slot is always as tall as the tallest effect and never shifts. */}
        {ordered.length > 0 ? (
          <div aria-live="polite" className="grid rounded-xl bg-muted/40 p-inset-sm">
            {ordered.map((ripple, index) => {
              const on = Boolean(approved[ripple.id]);
              const shown = ripple.id === focused?.id;

              return (
                <div
                  key={ripple.id}
                  aria-hidden={!shown}
                  inert={!shown}
                  className={cn(
                    "col-start-1 row-start-1 min-w-0 space-y-stack-xs",
                    !shown && "invisible"
                  )}
                >
                  <div className="flex items-center gap-inline-sm">
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-full", KIND_TONE[ripple.kind])}
                    />
                    <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                      {ripple.kind}
                    </span>
                    <span className="flex-1 text-right font-mono text-2xs tabular-nums text-muted-foreground">
                      {index + 1} of {ordered.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Previous effect"
                      onClick={() =>
                        setFocusId(ordered[(index - 1 + ordered.length) % ordered.length]!.id)
                      }
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full text-muted-foreground",
                        FOCUS
                      )}
                    >
                      <ChevronLeft aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next effect"
                      onClick={() => setFocusId(ordered[(index + 1) % ordered.length]!.id)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full text-muted-foreground",
                        FOCUS
                      )}
                    >
                      <ChevronRight aria-hidden className="size-4" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground">{ripple.label}</p>
                  {ripple.detail ? (
                    <p className="text-xs text-muted-foreground">{ripple.detail}</p>
                  ) : null}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      setApproved((prev) => ({ ...prev, [ripple.id]: !prev[ripple.id] }))
                    }
                    className={cn(
                      "flex min-h-11 items-center gap-inline-sm text-xs",
                      on ? "text-foreground" : "text-muted-foreground",
                      FOCUS
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-3 shrink-0 rounded-full border",
                        on ? cn("border-transparent", KIND_TONE[ripple.kind]) : "border-border"
                      )}
                    />
                    {on ? "Included" : "Skipped"} · tap to {on ? "skip" : "include"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

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
                  className={cn(
                    "mt-stack-xs size-2.5 shrink-0 rounded-full",
                    KIND_TONE[ripple.kind]
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{ripple.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {ripple.kind}
                    {on ? "" : " · skipped"}
                  </span>
                  {ripple.detail ? (
                    <span className="mt-stack-xs block text-xs text-muted-foreground">
                      {ripple.detail}
                    </span>
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
        {status === "ready" && !onApply ? "Preview only. No changes will be written." : null}
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
