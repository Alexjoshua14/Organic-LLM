"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type MemoryLensSkeletonProps = {
  variant: "inline" | "sheet";
  className?: string;
};

export function MemoryLensSkeleton({
  variant,
  className,
}: MemoryLensSkeletonProps) {
  return (
    <div
      className={cn(
        glass(),
        "rounded-2xl p-5 flex flex-col gap-4",
        variant === "sheet" && "px-2",
        className
      )}
    >
      <div className="h-8 w-48 rounded-lg bg-muted/50 animate-pulse" />
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-muted/30 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
