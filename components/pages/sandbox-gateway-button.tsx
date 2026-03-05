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
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );
}

/** Cache per signed-in user so we don't refetch on every mount. */
const showSandboxCache = new Map<string, boolean>();

/**
 * Renders a Sandbox Gateway entry when the signed-in user's profile has admin
 * (profiles.admin). Defaults to showing until the column exists; once you add
 * the admin column, only users with admin true see the button. Cached per user.
 */
export function SandboxGatewayButton() {
  const { userId } = useAuth();
  const [showSandbox, setShowSandbox] = useState<boolean | null>(() =>
    userId ? showSandboxCache.get(userId) ?? null : null,
  );

  useEffect(() => {
    if (!userId) return;
    const cached = showSandboxCache.get(userId);
    if (cached !== undefined) {
      setShowSandbox(cached);
      return;
    }
    setShowSandbox(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      showSandboxCache.set(userId, value);
      setShowSandbox(value);
    });
  }, [userId]);

  if (!userId || showSandbox === false) return null;
  /* showSandbox === null: default show while loading */

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="z-20"
    >
      <Link
        href="/sandbox"
        data-dim-background="full"
        className={cn(
          "group relative flex items-center gap-2.5 rounded-2xl px-5 py-2.5",
          "text-base font-medium tracking-tight",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          "transition-all duration-300 ease-out",
          "hover:scale-[1.03] active:scale-[0.98]",
        )}
        aria-label="Open Sandbox Gateway"
      >
        {/* Glow behind — soft halo */}
        <span
          className="absolute -inset-3 rounded-3xl bg-accent/25 blur-2xl opacity-80"
          aria-hidden
        />

        {/* Background layers with reduced max brightness; darkest = theme primary background */}
        <span className="absolute inset-0 rounded-2xl brightness-90 dark:brightness-75" aria-hidden>
          <span
            className="absolute inset-0 rounded-2xl bg-background"
            aria-hidden
          />
          {/* Single-hue accent streak — liquid glass / reflection, no hue shift = no mud */}
          <span
            className="absolute inset-0 rounded-2xl animate-[sandbox-border-shift_8s_ease-in-out_infinite]"
            style={{
              background:
                "linear-gradient(115deg, transparent 0%, transparent 32%, oklch(0.72 0.045 174 / 0.55) 42%, oklch(0.6 0.07 174 / 0.7) 50%, oklch(0.72 0.045 174 / 0.55) 58%, transparent 68%, transparent 100%)",
              backgroundSize: "200% 200%",
              backgroundPosition: "0% 50%",
            }}
            aria-hidden
          />
          <span
            className={cn(
              "absolute inset-px rounded-[calc(1rem-1px)]",
              glass(),
              "border border-white/20 dark:border-white/10",
              "group-hover:border-accent/30 group-hover:bg-accent/5",
              "dark:group-hover:border-accent/40 dark:group-hover:bg-accent/10",
              "transition-colors duration-300",
            )}
          />
          {/* Inner glow on hover */}
          <span
            className={cn(
              "absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-500",
              "group-hover:opacity-100",
            )}
            style={{ background: "oklch(0.573 0.105 174 / 0.2)" }}
            aria-hidden
          />
        </span>

        {/* Content — dual-layer mix-blend for high contrast on any background (Apple home bar style) */}
        <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
          {/* Layer 1: black + multiply → reads on light areas */}
          <span
            className="flex items-center gap-2.5 text-black mix-blend-multiply"
            aria-hidden
          >
            Sandbox
            <ArrowSvg className="h-4 w-4 shrink-0" />
          </span>
          {/* Layer 2: white + screen → reads on dark areas */}
          <span
            className="absolute inset-0 flex items-center justify-start gap-2.5 text-white mix-blend-screen"
            aria-hidden
          >
            Sandbox
            <ArrowSvg className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
