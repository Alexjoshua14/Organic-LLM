"use client";

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
        row ? "flex flex-row flex-wrap gap-2 overflow-x-auto pb-1" : "flex flex-col gap-2",
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
              "group flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
              row ? "shrink-0 max-w-[10rem]" : "",
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
                "mt-1.5 h-2 w-2 shrink-0 rounded-full border transition-colors",
                active
                  ? "border-amber-400/80 bg-amber-400/90 shadow-[0_0_10px_oklch(0.78_0.12_75/0.35)]"
                  : "border-border bg-muted-foreground/25 group-hover:border-foreground/30"
              )}
            />
            <span
              className={cn(
                "text-[11px] leading-snug",
                active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/90",
                row && "line-clamp-2"
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
