"use client";

import { motion } from "framer-motion";

import { WelcomeHighlightRow } from "./welcome-highlight-row";
import { useWelcomeMotion } from "./welcome-motion";

import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type WelcomeHighlightsProps = {
  className?: string;
};

export function WelcomeHighlights({ className }: WelcomeHighlightsProps) {
  const { inViewGroup, staggerItem } = useWelcomeMotion();

  return (
    <section
      aria-labelledby="welcome-highlights-heading"
      className={cn(
        "pt-4 pb-16 sm:pt-6 sm:pb-24 [content-visibility:auto] [contain-intrinsic-size:auto_2400px]",
        className
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        <motion.header className="mb-12 max-w-xl text-left" {...inViewGroup} variants={staggerItem}>
          <h2
            className="cursor-auto select-text font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-3xl"
            id="welcome-highlights-heading"
          >
            {welcomeCopy.highlights.intro}
          </h2>
        </motion.header>
        <div className="flex flex-col gap-16 sm:gap-20">
          {welcomeCopy.highlights.items.map((item, index) => (
            <WelcomeHighlightRow
              key={item.id}
              enterFrom={index % 2 === 0 ? "left" : "right"}
              item={item}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
