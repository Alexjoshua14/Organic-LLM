"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { WelcomeFeatureCard } from "./welcome-feature-card";
import { WelcomeHighlightVisual } from "./welcome-highlight-visual";
import { useWelcomeMotion } from "./welcome-motion";

import { glass } from "@/components/design-system/primitives";
import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

const modePlaceholderId: Record<string, string> = {
  main: "feature-chat",
  arcadia: "feature-arcadia",
  noesis: "feature-noesis",
};

type WelcomeFeaturesProps = {
  className?: string;
};

export function WelcomeFeatures({ className }: WelcomeFeaturesProps) {
  const { inViewGroup, inViewItem, riseFromBehind, fromLeft, fromRight } = useWelcomeMotion();
  const { features } = welcomeCopy;
  const { chat, rabbitHoles, strata } = features;

  return (
    <section
      aria-labelledby="welcome-features-heading"
      className={cn(
        "py-12 pb-16 sm:py-14 sm:pb-20 [content-visibility:auto] [contain-intrinsic-size:auto_1200px]",
        className
      )}
      id="welcome-features"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 sm:px-8 lg:px-12">
        <motion.header
          className="mb-6 max-w-2xl shrink-0 origin-bottom-left text-left sm:mb-8"
          {...inViewGroup}
          variants={riseFromBehind}
        >
          <h2
            className="cursor-auto select-text font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-3xl"
            id="welcome-features-heading"
          >
            {features.heading}
          </h2>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {features.intro}
          </p>
        </motion.header>

        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "flex shrink-0 flex-col gap-3 rounded-2xl border border-border/50 p-4 sm:p-5",
              glass({ border: "none", opaque: true })
            )}
          >
            <motion.div {...inViewItem}>
              <h3 className="cursor-auto select-text font-commissioner text-lg font-light tracking-tight text-foreground sm:text-xl">
                {chat.title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted-foreground">
                {chat.summary}
              </p>
              <p className="mt-2">
                <Link
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  href={chat.showcaseLink.href}
                >
                  {chat.showcaseLink.label}
                  <ArrowRight aria-hidden className="size-3.5 shrink-0" strokeWidth={1.5} />
                </Link>
              </p>
            </motion.div>

            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-stretch sm:gap-6">
              {chat.modes.map((mode, index) => (
                <motion.li
                  key={mode.id}
                  className="flex min-w-0 flex-col"
                  custom={index}
                  {...inViewItem}
                >
                  <h4 className="cursor-auto select-text text-sm font-medium text-foreground">
                    {mode.title}
                  </h4>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-snug text-muted-foreground sm:text-sm">
                    {mode.body}
                  </p>
                  <div className="mt-3 w-full sm:mt-4">
                    <WelcomeHighlightVisual
                      aspect="feature"
                      id={modePlaceholderId[mode.id] ?? `feature-${mode.id}`}
                      imageAlt={mode.visualPlaceholder.hint}
                      lazyImages
                      placeholder={mode.visualPlaceholder}
                      size="mode"
                    />
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>

          <motion.div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2" {...inViewGroup}>
            <WelcomeFeatureCard
              body={rabbitHoles.body}
              imageSrc={rabbitHoles.imageSrc}
              placeholderId="feature-rabbitholes"
              title={rabbitHoles.title}
              variants={fromLeft}
              visualPlaceholder={rabbitHoles.visualPlaceholder}
            />

            <WelcomeFeatureCard
              body={strata.body}
              placeholderId="feature-strata"
              title={strata.title}
              variants={fromRight}
              visualPlaceholder={strata.visualPlaceholder}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
