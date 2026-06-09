"use client";

import type { ReactNode } from "react";

import { motion } from "framer-motion";

import { useWelcomeMotion } from "./welcome-motion";

import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type WelcomeHeadlineProps = {
  className?: string;
};

function MaskLine({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const { maskReveal, reduce } = useWelcomeMotion();

  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        transition={reduce ? undefined : { delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        variants={maskReveal}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function WelcomeHeadline({ className }: WelcomeHeadlineProps) {
  const { staggerItem, maskReveal, reduce } = useWelcomeMotion();

  return (
    <motion.h1
      variants={staggerItem}
      style={{ fontFamily: "var(--font-satoshi), sans-serif" }}
      className={cn(
        "mt-6 sm:mt-8 max-w-xl text-balance text-4xl font-black leading-[0.95] tracking-[-0.03em] text-foreground sm:text-[2.75rem] md:text-5xl lg:text-[3.25rem]",
        className
      )}
    >
      <MaskLine>{welcomeCopy.headline.line1}</MaskLine>
      <span className="block">
        <span className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={cn(
              "inline-block bg-linear-to-br from-accent to-emerald-600/80 bg-clip-text text-accent supports-[background-clip:text]:text-transparent",
              !reduce && "motion-safe:animate-[welcome-accent-shift_10s_ease-in-out_infinite]"
            )}
            style={!reduce ? { backgroundSize: "200% 200%" } : undefined}
            transition={reduce ? undefined : { delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            variants={maskReveal}
          >
            {welcomeCopy.headline.accent}
          </motion.span>
        </span>{" "}
        <MaskLine delay={0.18}>{welcomeCopy.headline.line2}</MaskLine>
      </span>
    </motion.h1>
  );
}
