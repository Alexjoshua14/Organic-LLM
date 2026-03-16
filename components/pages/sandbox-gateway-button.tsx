"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { getShowSandboxGatewayForCurrentUser } from "@/data/supabase/profiles";

function ArrowSvg({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M13 7l5 5m0 0l-5 5m5-5H6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

/** Cache per signed-in user so we don't refetch on every mount. Shared with ShowcaseGatewayButton. */
export const showGatewayCache = new Map<string, boolean>();

/**
 * Renders a Sandbox Gateway entry when the signed-in user's profile has admin
 * (profiles.admin). Defaults to showing until the column exists; once you add
 * the admin column, only users with admin true see the button. Cached per user.
 */
export function SandboxGatewayButton() {
  const { userId } = useAuth();
  const [showSandbox, setShowSandbox] = useState<boolean | null>(() =>
    userId ? (showGatewayCache.get(userId) ?? null) : null
  );

  useEffect(() => {
    if (!userId) return;
    const cached = showGatewayCache.get(userId);

    if (cached !== undefined) {
      setShowSandbox(cached);

      return;
    }
    setShowSandbox(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      showGatewayCache.set(userId, value);
      setShowSandbox(value);
    });
  }, [userId]);

  if (!userId || showSandbox === false) return null;
  /* showSandbox === null: default show while loading */

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="z-20"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{
        duration: 0.6,
        delay: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <Link
        aria-label="Open Sandbox Gateway"
        className={cn(
          "group relative flex items-center gap-2.5 rounded-2xl px-5 py-2.5",
          "text-base font-medium tracking-tight",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          "transition-all duration-300 ease-out",
          "hover:scale-[1.03] active:scale-[0.98]"
        )}
        data-dim-background="full"
        href="/sandbox"
      >
        {/* Glow behind — soft halo */}
        <span
          aria-hidden
          className="absolute -inset-3 rounded-3xl bg-accent/25 blur-2xl opacity-80"
        />

        {/* Background layers with reduced max brightness; darkest = theme primary background */}
        <span aria-hidden className="absolute inset-0 rounded-2xl brightness-90 dark:brightness-75">
          <span aria-hidden className="absolute inset-0 rounded-2xl bg-background" />
          {/* Single-hue accent streak — liquid glass / reflection, no hue shift = no mud */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl animate-[sandbox-border-shift_8s_ease-in-out_infinite]"
            style={{
              background:
                "linear-gradient(115deg, transparent 0%, transparent 32%, oklch(0.72 0.045 174 / 0.55) 42%, oklch(0.6 0.07 174 / 0.7) 50%, oklch(0.72 0.045 174 / 0.55) 58%, transparent 68%, transparent 100%)",
              backgroundSize: "200% 200%",
              backgroundPosition: "0% 50%",
            }}
          />
          <span
            className={cn(
              "absolute inset-px rounded-[calc(1rem-1px)]",
              glass(),
              "border border-white/20 dark:border-white/10",
              "group-hover:border-accent/30 group-hover:bg-accent/5",
              "dark:group-hover:border-accent/40 dark:group-hover:bg-accent/10",
              "transition-colors duration-300"
            )}
          />
          {/* Inner glow on hover */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-500",
              "group-hover:opacity-100"
            )}
            style={{ background: "oklch(0.573 0.105 174 / 0.2)" }}
          />
        </span>

        {/* Content — dual-layer mix-blend for high contrast on any background (Apple home bar style) */}
        <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
          {/* Layer 1: black + multiply → reads on light areas */}
          <span
            aria-hidden
            className="flex items-center gap-2.5 text-secondary-foreground text-sm mix-blend-multiply"
          >
            Sandbox
            <ArrowSvg className="h-4 w-4 shrink-0" />
          </span>
          {/* Layer 2: white + screen → reads on dark areas */}
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-start gap-2.5 text-secondary-background text-sm mix-blend-screen"
          >
            Sandbox
            <ArrowSvg className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
