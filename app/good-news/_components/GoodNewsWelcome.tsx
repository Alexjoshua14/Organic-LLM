"use client";

import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const TRUST_SOURCES = ["Reuters", "AP", "Nature", "WHO", "NASA"];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Full-screen welcome hero shown when no digest exists yet. Centered, bold, and
 * composed: a hairline + small-caps kicker, an oversized Satoshi headline with a
 * restrained accent-gradient focal word, an emphasized supporting line, a calm
 * live status chip, and a small-caps trust row. Motion is slow and deliberate
 * and fully disabled under prefers-reduced-motion.
 */
export function GoodNewsWelcome() {
  const reduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.09,
        delayChildren: reduceMotion ? 0 : 0.05,
      },
    },
  };

  const item: Variants = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      };

  return (
    <section className="relative mx-auto flex max-w-2xl flex-col items-center px-2 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent) 10%, transparent) 0%, transparent 70%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center"
      >
        <motion.div variants={item} className="flex flex-col items-center gap-3">
          <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
            A better daily read
          </p>
        </motion.div>

        <motion.h1
          variants={item}
          style={{ fontFamily: "var(--font-satoshi), sans-serif" }}
          className="mt-6 text-balance text-5xl font-black leading-[0.92] tracking-[-0.03em] text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Today, some things went{" "}
          <span className="bg-linear-to-br from-accent to-emerald-500/85 bg-clip-text text-accent supports-[background-clip:text]:text-transparent">
            right.
          </span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          The ten best of them,{" "}
          <strong className="font-medium text-foreground">gathered each morning</strong> and{" "}
          <strong className="font-medium text-foreground">fact-checked</strong> before you ever see
          them.
        </motion.p>

        <motion.div variants={item} role="status" aria-live="polite" className="mt-8">
          <span
            className={cn(
              glass(),
              "inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm text-foreground"
            )}
          >
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent/60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Today&apos;s good news is on its way
          </span>
        </motion.div>

        <motion.ul
          variants={item}
          aria-label="Sources we verify against"
          className="mt-10 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground/80"
        >
          {TRUST_SOURCES.map((name, index) => (
            <Fragment key={name}>
              {index > 0 ? (
                <li aria-hidden="true" className="text-muted-foreground/40">
                  ·
                </li>
              ) : null}
              <li>{name}</li>
            </Fragment>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
