import type { MeasureSize } from "@/lib/schemas/gen-ui";

import { cn } from "@/lib/utils";

/** Widget chrome + plot density for measure variants. */
export const MEASURE_SIZE: Record<
  MeasureSize,
  {
    section: string;
    title: string;
    subtitle: string;
    plotClass: string;
    /** SVG viewBox height for line / columns / pie. */
    plotHeight: number;
    track: string;
    legend: string;
    value: string;
  }
> = {
  sm: {
    section: "p-inset-sm gap-stack-sm",
    title: "text-xs font-medium",
    subtitle: "text-2xs",
    plotClass: "h-24",
    plotHeight: 96,
    track: "h-2",
    legend: "text-2xs",
    value: "text-xs",
  },
  md: {
    section: "p-inset-md gap-stack-md",
    title: "text-sm font-medium",
    subtitle: "text-xs",
    plotClass: "h-36",
    plotHeight: 144,
    track: "h-3",
    legend: "text-xs",
    value: "text-sm",
  },
  lg: {
    section: "p-inset-lg gap-stack-lg",
    title: "text-base font-medium",
    subtitle: "text-sm",
    plotClass: "h-48",
    plotHeight: 192,
    track: "h-4",
    legend: "text-sm",
    value: "text-base",
  },
};

export function measureSectionClass(size: MeasureSize): string {
  return cn("w-full rounded-2xl bg-muted/30", MEASURE_SIZE[size].section);
}
