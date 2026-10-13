"use client";

import type { WelcomeHighlightItem } from "@/lib/welcome/copy";

import Link from "next/link";
import { motion } from "framer-motion";

import { WelcomeHighlightVisual, type WelcomeVisualImageSrc } from "./welcome-highlight-visual";
import { useWelcomeMotion } from "./welcome-motion";

import { welcomeHighlightFrameClass } from "@/lib/welcome/visual-aspect";
import { cn } from "@/lib/utils";

type WelcomeHighlightRowProps = {
  item: WelcomeHighlightItem & { imageSrc?: WelcomeVisualImageSrc };
  /** Rows alternate sides by order, independent of their text/visual layout. */
  enterFrom: "left" | "right";
};

export function WelcomeHighlightRow({ item, enterFrom }: WelcomeHighlightRowProps) {
  const { inViewGroup, fromLeft, fromRight } = useWelcomeMotion();
  const enter = enterFrom === "left" ? fromLeft : fromRight;
  const reversed = item.reverse === true;

  return (
    <motion.article
      className={cn(
        "flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:gap-12 lg:gap-16",
        reversed && "sm:flex-row-reverse"
      )}
      {...inViewGroup}
    >
      <motion.div className="min-w-0 flex-1 text-left" variants={enter}>
        <h3 className="cursor-auto select-text font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-[1.65rem]">
          {item.title}
        </h3>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px] sm:leading-[1.65]">
          {item.body}
        </p>
        {"link" in item && item.link ? (
          <p className="mt-4">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={item.link.href}
            >
              {item.link.label}
            </Link>
          </p>
        ) : null}
      </motion.div>
      <motion.div className={welcomeHighlightFrameClass} variants={enter}>
        <WelcomeHighlightVisual
          aspect="highlight"
          className="w-full max-w-none"
          id={item.id}
          imageAlt={item.visualPlaceholder.hint}
          imageSrc={item.imageSrc}
          lazyImages={"imageSrc" in item && item.imageSrc !== undefined}
          placeholder={item.visualPlaceholder}
          size="highlight"
        />
      </motion.div>
    </motion.article>
  );
}
