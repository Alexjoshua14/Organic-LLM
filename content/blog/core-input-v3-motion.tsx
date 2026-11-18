"use client";

import type { ReactNode } from "react";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Scroll reveals for the CoreInput v3 post. Entrance-only and brief: a short rise and fade as a
 * block enters the screen, inside the 250–400ms band in docs/design/motion-and-text-timing.md.
 * Reduced motion renders everything in place with no movement.
 */
export const BLOG_REVEAL = {
  /** Seconds for one block to settle. */
  durationS: 0.4,
  /** How far a block rises as it fades in, in px. */
  rise: 12,
  /** Seconds between items in a staggered group. */
  staggerS: 0.05,
  /** Decelerating ease shared with the showcase's section reveals. */
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

const VIEWPORT = { once: true, amount: 0.15, margin: "0px 0px -8% 0px" } as const;

type Tag = "div" | "ul" | "li" | "figure" | "aside" | "header";

/** One block that rises and fades in when it scrolls into view. */
export function Reveal({
  as = "div",
  className,
  children,
}: {
  as?: Tag;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  if (reduce) return <Component className={className}>{children}</Component>;

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: BLOG_REVEAL.rise }}
      transition={{ duration: BLOG_REVEAL.durationS, ease: BLOG_REVEAL.ease }}
      viewport={VIEWPORT}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </Component>
  );
}

const group: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: BLOG_REVEAL.staggerS } },
};

const item: Variants = {
  hidden: { opacity: 0, y: BLOG_REVEAL.rise / 2 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: BLOG_REVEAL.durationS, ease: BLOG_REVEAL.ease },
  },
};

/** A group whose children (`StaggerItem`) arrive one after another. */
export function Stagger({
  as = "div",
  className,
  children,
}: {
  as?: Tag;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  if (reduce) return <Component className={className}>{children}</Component>;

  return (
    <Component
      className={className}
      initial="hidden"
      variants={group}
      viewport={VIEWPORT}
      whileInView="show"
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  as = "div",
  className,
  children,
}: {
  as?: Tag;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component className={className} variants={reduce ? undefined : item}>
      {children}
    </Component>
  );
}
