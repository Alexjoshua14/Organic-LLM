"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type AnatomyHeroProps = {
  thesis: string;
  prompt: string;
  className?: string;
};

export function AnatomyHero({ thesis, prompt, className }: AnatomyHeroProps) {
  return (
    <header className={cn("mb-10 text-center sm:text-left", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground",
            glass()
          )}
        >
          <span aria-hidden>📼</span>
          Recorded demo — static trace, no live model or tools
        </span>
      </div>
      <h1 className="mb-3 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
        Anatomy of a Response
      </h1>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mx-0 mx-auto">
        {thesis}
      </p>
      <div className="mx-auto max-w-3xl sm:mx-0">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Example prompt
        </p>
        <div
          className={cn(
            "rounded-xl border border-border/70 px-4 py-3 text-left text-sm leading-relaxed text-foreground",
            glass()
          )}
        >
          {prompt}
        </div>
      </div>
    </header>
  );
}
