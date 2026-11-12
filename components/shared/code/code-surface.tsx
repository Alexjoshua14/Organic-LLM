"use client";

import type { CSSProperties, ReactNode } from "react";

import styles from "./code.module.css";

import { fontMono } from "@/config/fonts";
import { cn } from "@/lib/utils";

type CodeSurfaceProps = {
  /** Lines wrap instead of scrolling sideways. */
  wrap?: boolean;
  /** Wrap on a narrow screen until the reader chooses (see useCodeWrap). Ignored when `wrap`. */
  autoWrap?: boolean;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>;

/**
 * The framed well every code view sits in: the palette (`organic-code`), the code font mounted on
 * the surface itself (the root layout is untouched), border, radius and background. `not-prose`
 * keeps Tailwind Typography out of it.
 */
export function CodeSurface({
  wrap = false,
  autoWrap = false,
  className,
  children,
  ...data
}: CodeSurfaceProps) {
  return (
    <div
      {...data}
      className={cn(styles.surface, "organic-code not-prose", fontMono.variable, className)}
      data-wrap={wrap ? "true" : autoWrap ? "auto" : "false"}
    >
      {children}
    </div>
  );
}

type CodeScrollProps = {
  /** Names the region for assistive tech, e.g. "Diff of lib/x.ts". */
  label: string;
  /** Digits in the widest line number; sizes the gutters. */
  digits?: number;
  /** Add a tab stop so keyboard users can scroll it. Skip when nothing can scroll (wrapped). */
  focusable?: boolean;
  className?: string;
  children: ReactNode;
};

/** The scrollable region of a code view. A scrollable region must be keyboard-focusable. */
export function CodeScroll({
  label,
  digits,
  focusable = true,
  className,
  children,
}: CodeScrollProps) {
  return (
    <div
      aria-label={label}
      className={cn(styles.scroll, focusable && "organic-focus", className)}
      role="region"
      style={digits === undefined ? undefined : ({ "--code-digits": digits } as CSSProperties)}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={focusable ? 0 : undefined}
    >
      {children}
    </div>
  );
}
