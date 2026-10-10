"use client";

import type { PaintingState } from "@/lib/personas/domains/acrylic/painting-state";

const pct = (value: number) => `${Math.round(value * 100)}%`;

const VALUE_BANDS = [
  ["veryDark", "Very dark", "#1f1d1b"],
  ["dark", "Dark", "#4a4540"],
  ["mid", "Mid", "#8a847c"],
  ["light", "Light", "#c4beb5"],
  ["veryLight", "Very light", "#f1ede6"],
] as const;

/** What the assistant currently knows about the painting, measured and observed. */
export function PaintingStateSummary({ state }: { state: PaintingState }) {
  const { metrics } = state;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background-secondary/40 p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Photo #{state.revision}.</span>{" "}
        {state.summary}
      </p>

      {metrics.palette.length ? (
        <figure className="space-y-1">
          <figcaption className="text-2xs uppercase tracking-wide text-muted-foreground">
            Colour by area
          </figcaption>
          <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-full">
            {metrics.palette.map((swatch) => (
              <span key={swatch.hex} style={{ background: swatch.hex, flexGrow: swatch.share }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground">
            {metrics.palette.slice(0, 5).map((swatch) => (
              <li key={swatch.hex} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: swatch.hex }}
                />
                {pct(swatch.share)} {swatch.label}
              </li>
            ))}
          </ul>
        </figure>
      ) : null}

      <figure className="space-y-1">
        <figcaption className="text-2xs uppercase tracking-wide text-muted-foreground">
          Values
        </figcaption>
        <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-full">
          {VALUE_BANDS.map(([key, , color]) => (
            <span key={key} style={{ background: color, flexGrow: metrics.values[key] }} />
          ))}
        </div>
        <p className="text-2xs text-muted-foreground">
          {VALUE_BANDS.filter(([key]) => metrics.values[key] >= 0.01)
            .map(([key, label]) => `${label} ${pct(metrics.values[key])}`)
            .join(" · ")}
        </p>
      </figure>

      {state.latestChanges.length ? (
        <div className="space-y-1">
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">
            Since the last photo
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {state.latestChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
