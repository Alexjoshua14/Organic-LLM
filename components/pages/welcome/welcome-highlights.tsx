"use client";

import { WelcomeHighlightRow } from "./welcome-highlight-row";

import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type WelcomeHighlightsProps = {
  className?: string;
};

export function WelcomeHighlights({ className }: WelcomeHighlightsProps) {
  return (
    <section
      aria-labelledby="welcome-highlights-heading"
      className={cn("pt-4 pb-16 sm:pt-6 sm:pb-24", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <header className="mb-12 max-w-xl text-left">
          <h2
            className="font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-3xl"
            id="welcome-highlights-heading"
          >
            {welcomeCopy.highlights.intro}
          </h2>
        </header>
        <div className="flex flex-col gap-16 sm:gap-20">
          {welcomeCopy.highlights.items.map((item) => (
            <WelcomeHighlightRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
