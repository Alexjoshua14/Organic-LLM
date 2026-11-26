"use client";

import type { MeasureBlock } from "@/lib/schemas/gen-ui";

import { makeTicks } from "./measure-math";
import { Axis, Pin, RowShell, Span, Track } from "./primitives";
import { MEASURE_ROW_STAGGER_S } from "./measure-timing";

import { formatMeasureValue, measureRowValueLabel } from "@/lib/schemas/gen-ui/measure";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type MeasureViewProps = {
  block: MeasureBlock;
  partial?: boolean;
  condensed?: boolean;
  heading?: "h3" | "h4";
};

export function MeasureView({
  block,
  condensed = false,
  heading: Heading = "h3",
}: MeasureViewProps) {
  const { domain, unit } = block;
  const ticks = condensed ? [domain.min, domain.max] : (block.ticks ?? makeTicks(domain));

  return (
    <section
      className={cn(
        "w-full",
        condensed
          ? "mx-auto max-w-sm space-y-stack-sm"
          : cn("rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)
      )}
    >
      <header className={spacing.card.labelStack}>
        <Heading className="text-sm font-medium text-foreground">{block.title}</Heading>
        {block.subtitle ? <p className="text-xs text-muted-foreground">{block.subtitle}</p> : null}
      </header>

      {/* Condensed: label sits stack-xs above its bar, rows sit stack-md apart, so each label
          groups with its own bar rather than floating between two. */}
      <ul className={condensed ? "space-y-stack-md" : spacing.card.blockItems}>
        {block.rows.map((row, i) => {
          const delay = i * MEASURE_ROW_STAGGER_S;
          const label = measureRowValueLabel(row, unit);
          const estimate =
            row.range && row.value !== undefined
              ? `${formatMeasureValue(row.value, unit)} point estimate`
              : undefined;

          return (
            <RowShell
              key={row.id}
              label={row.label}
              value={label}
              note={condensed ? undefined : row.note}
              condensed={condensed}
              estimate={estimate}
            >
              <Track domain={domain} ticks={ticks} thin={condensed}>
                {row.range ? (
                  <>
                    <Span
                      from={row.range[0]}
                      to={row.range[1]}
                      domain={domain}
                      tone={row.tone}
                      delay={delay}
                      glass={condensed}
                    />
                    {row.value !== undefined ? <Pin at={row.value} domain={domain} /> : null}
                  </>
                ) : (
                  <Span
                    from={domain.min}
                    to={row.value!}
                    domain={domain}
                    tone={row.tone}
                    delay={delay}
                    glass={condensed}
                  />
                )}
              </Track>
            </RowShell>
          );
        })}
      </ul>

      <Axis domain={domain} ticks={ticks} unit={unit} />
      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
