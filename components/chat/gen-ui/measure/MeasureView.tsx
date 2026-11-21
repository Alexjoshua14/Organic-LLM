"use client";

import type { MeasureBlock } from "@/lib/schemas/gen-ui";

import { makeTicks } from "./measure-math";
import { Axis, Pin, RowShell, Span, Track } from "./primitives";
import { MEASURE_ROW_STAGGER_S } from "./measure-timing";

import { measureRowValueLabel } from "@/lib/schemas/gen-ui/measure";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type MeasureViewProps = {
  block: MeasureBlock;
  partial?: boolean;
};

export function MeasureView({ block }: MeasureViewProps) {
  const { domain, unit } = block;
  const ticks = block.ticks ?? makeTicks(domain);

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <header className={spacing.card.labelStack}>
        <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
        {block.subtitle ? (
          <p className="text-xs text-muted-foreground">{block.subtitle}</p>
        ) : null}
      </header>

      <ul className={spacing.card.blockItems}>
        {block.rows.map((row, i) => {
          const delay = i * MEASURE_ROW_STAGGER_S;
          const label = measureRowValueLabel(row, unit);

          return (
            <RowShell key={row.id} label={row.label} value={label} note={row.note}>
              <Track domain={domain} ticks={ticks}>
                {row.range ? (
                  <>
                    <Span
                      from={row.range[0]}
                      to={row.range[1]}
                      domain={domain}
                      tone={row.tone}
                      delay={delay}
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
                  />
                )}
              </Track>
            </RowShell>
          );
        })}
      </ul>

      <Axis domain={domain} ticks={ticks} unit={unit} />
      {block.footnote ? (
        <p className="text-xs text-muted-foreground">{block.footnote}</p>
      ) : null}
    </section>
  );
}
