"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ShowcaseHeroProps = {
  title: string;
  thesis: string;
  className?: string;
};

export function ShowcaseHero({ title, thesis, className }: ShowcaseHeroProps) {
  return (
    <header className={cn("mb-10", className)}>
      <div
        className={cn(
          "rounded-2xl border border-border/60 p-6 text-center shadow-sm sm:p-8 sm:text-left",
          glass({ border: "none" })
        )}
      >
        <h1 className="mb-3 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mx-0">
          {thesis}
        </p>
      </div>
    </header>
  );
}
