"use client";

import { cn } from "@/lib/utils";

export type PipelineSection =
  | {
      boundary?: string;
      steps: readonly string[];
      tunnel?: never;
    }
  | {
      /** TLS transit path between boundaries. Rendered as a tunnel/path. */
      tunnel: { from: string; to: string; label: string };
      boundary?: never;
      steps?: never;
    };

export function PipelineDiagram({
  sections,
  className,
}: {
  sections: readonly PipelineSection[];
  className?: string;
}) {
  return (
    <div
      aria-label="End-to-end pipeline"
      className={cn("my-6 overflow-hidden rounded-lg border border-border/50", className)}
      role="figure"
    >
      {sections.map((section, sectionIndex) => {
        if ("tunnel" in section && section.tunnel) {
          const { from, to, label } = section.tunnel;

          return (
            <div
              key={sectionIndex}
              className="border-t border-border/50 first:border-t-0 bg-muted/10"
            >
              <div
                aria-hidden
                className="mx-4 my-3 flex items-center justify-between gap-4 rounded-md border-2 border-dashed border-border/60 bg-background/50 px-4 py-3"
              >
                <span className="text-xs font-medium text-muted-foreground shrink-0">{from}</span>
                <span className="text-center text-sm text-foreground">{label}</span>
                <span className="text-xs font-medium text-muted-foreground shrink-0">{to}</span>
              </div>
            </div>
          );
        }
        const { boundary, steps = [] } = section;

        return (
          <div
            key={sectionIndex}
            className={cn(
              "border-t border-border/50 first:border-t-0",
              boundary ? "bg-muted/40" : "bg-muted/15"
            )}
          >
            {boundary && (
              <div
                className={cn(
                  "px-5 border-b border-border/40",
                  steps.length === 0 ? "py-3" : "py-2.5"
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {boundary}
                </span>
              </div>
            )}
            {steps.length > 0 && (
              <ul className="flex flex-col list-none p-0 m-0 px-5 py-4">
                {steps.map((label, stepIndex) => (
                  <li key={stepIndex} className="flex items-start gap-4">
                    <div className="flex flex-col items-center shrink-0 pt-1.5">
                      <div
                        aria-hidden
                        className="size-2.5 rounded-full border-2 border-foreground/60 bg-background shrink-0"
                      />
                      {stepIndex < steps.length - 1 && (
                        <div className="w-px min-h-[18px] bg-border mt-0.5" />
                      )}
                    </div>
                    <span className="pt-1 text-sm text-foreground leading-snug min-w-0">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
