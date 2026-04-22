"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type StageMiniMapProps = {
  stages: readonly { id: string; title: string }[];
  activeIndex: number;
  onStageSelect?: (index: number) => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
};

export function StageMiniMap({
  stages,
  activeIndex,
  onStageSelect,
  className,
  orientation = "vertical",
}: StageMiniMapProps) {
  const row = orientation === "horizontal";

  return (
    <nav
      aria-label="Pipeline stages"
      className={cn(
        "rounded-xl border border-border/60 p-2 shadow-sm",
        glass({ border: "none" }),
        row
          ? "flex snap-x snap-mandatory flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-2",
        className
      )}
    >
      {stages.map((s, i) => {
        const active = i === activeIndex;

        return (
          <button
            key={s.id}
            type="button"
            className={cn(
              "group flex rounded-lg px-2.5 py-2 transition-colors",
              row
                ? "shrink-0 snap-start flex-row items-center justify-center gap-1.5 text-center"
                : "w-full flex-row items-center justify-center gap-2 text-left",
              active ? "bg-muted/50" : "hover:bg-muted/30"
            )}
            onClick={() => {
              const el = document.querySelector(`[data-stage-index="${i}"]`);

              el?.scrollIntoView({ behavior: "smooth", block: "start" });
              onStageSelect?.(i);
            }}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 shrink-0 rounded-full border transition-colors",
                active
                  ? "border-amber-400/80 bg-amber-400/90 shadow-[0_0_10px_oklch(0.78_0.12_75/0.35)]"
                  : "border-border bg-muted-foreground/25 group-hover:border-foreground/30"
              )}
            />
            <span
              className={cn(
                "text-[11px] leading-snug",
                active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/90",
                row ? "whitespace-nowrap text-center" : "min-w-0 flex-1 text-left"
              )}
            >
              {row ? `${i + 1}. ${s.title}` : s.title}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
