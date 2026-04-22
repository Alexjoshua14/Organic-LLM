"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type AnatomyHeroProps = {
  thesis: string;
  className?: string;
};

export function AnatomyHero({ thesis, className }: AnatomyHeroProps) {
  return (
    <header className={cn("mb-10", className)}>
      <div
        className={cn(
          "rounded-2xl border border-border/60 p-6 text-center shadow-sm sm:p-8 sm:text-left",
          glass({ border: "none" })
        )}
      >
        <h1 className="mb-3 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          Anatomy of a Response
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mx-0">{thesis}</p>
      </div>
    </header>
  );
}
