import type { CSSProperties } from "react";

/** Chart/swatch color token for an option index (cycles chart-1…chart-5). */
export function optionStyle(index: number): CSSProperties {
  return {
    "--option-color": `var(--chart-${(index % 5) + 1})`,
  } as CSSProperties;
}
