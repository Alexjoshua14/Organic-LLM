"use client";

import type { Variants } from "framer-motion";

import { motion } from "framer-motion";

import { WelcomeHighlightVisual, type WelcomeVisualImageSrc } from "./welcome-highlight-visual";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type WelcomeFeatureCardProps = {
  title: string;
  body: string;
  placeholderId: string;
  visualPlaceholder: { label: string; hint: string };
  imageSrc?: WelcomeVisualImageSrc;
  className?: string;
  /** Entrance variants; the parent group owns the in-view trigger. */
  variants?: Variants;
};

export function WelcomeFeatureCard({
  title,
  body,
  placeholderId,
  visualPlaceholder,
  imageSrc,
  className,
  variants,
}: WelcomeFeatureCardProps) {
  return (
    <motion.div
      variants={variants}
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border border-border/50 p-4 sm:p-5",
        glass({ border: "none", opaque: true }),
        className
      )}
    >
      <h3 className="cursor-auto select-text font-commissioner text-base font-light tracking-tight text-foreground sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 line-clamp-3 shrink-0 text-sm leading-snug text-muted-foreground">
        {body}
      </p>
      <div className="mt-3 flex w-full min-h-0 flex-1 items-center justify-center">
        <WelcomeHighlightVisual
          aspect="feature"
          className="w-full"
          id={placeholderId}
          imageAlt={visualPlaceholder.hint}
          imageSrc={imageSrc}
          lazyImages
          objectPosition={imageSrc ? "center center" : undefined}
          placeholder={visualPlaceholder}
          size="mode"
        />
      </div>
    </motion.div>
  );
}
