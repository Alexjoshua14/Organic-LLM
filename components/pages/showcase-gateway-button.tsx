"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { showGatewayCache } from "./sandbox-gateway-button";

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

/**
 * Warm amber / natural sunlight color temperature (heliophysics-inspired).
 * oklch hue ~75 = warm gold; L/C tuned for a soft “sun on glass” glow.
 */
const SHOWCASE_SUNLIGHT_HUE = "75";
const SUNLIGHT_L = "0.72";
const SUNLIGHT_C = "0.09";
const SUNLIGHT_C_SOFT = "0.05";
const SUNLIGHT_C_MID = "0.07";

/**
 * Renders a Showcase gateway entry when the signed-in user can see the sandbox
 * (same visibility as SandboxGatewayButton). Uses shared showGatewayCache.
 * Styled with a warm amber / sunlight glow.
 */
export function ShowcaseGatewayButton() {
  const { userId } = useAuth();
  const [show, setShow] = useState<boolean | null>(() =>
    userId ? (showGatewayCache.get(userId) ?? null) : null
  );

  useEffect(() => {
    if (!userId) return;
    const cached = showGatewayCache.get(userId);

    if (cached !== undefined) {
      setShow(cached);

      return;
    }
    setShow(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      showGatewayCache.set(userId, value);
      setShow(value);
    });
  }, [userId]);

  if (!userId || show === false) return null;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="z-20"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{
        duration: 0.6,
        delay: 0.45,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <Link
        aria-label="Open Showcase"
        className={cn(
          "group/showcase relative flex items-center gap-2.5 rounded-2xl px-5 py-2.5",
          "text-base font-medium tracking-tight",
          "outline-none focus-visible:ring-2 focus-visible:ring-(--showcase-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          "transition-all duration-300 ease-out",
          "hover:scale-[1.03] active:scale-[0.98]"
        )}
        data-dim-background="full"
        href="/showcase"
        style={
          {
            "--showcase-ring": `oklch(${SUNLIGHT_L} ${SUNLIGHT_C} ${SHOWCASE_SUNLIGHT_HUE} / 0.22)`,
          } as React.CSSProperties
        }
      >
        <span
          aria-hidden
          className="absolute -inset-3 rounded-3xl blur-2xl opacity-40"
          style={{
            background: `oklch(${SUNLIGHT_L} ${SUNLIGHT_C} ${SHOWCASE_SUNLIGHT_HUE} / 0.12)`,
          }}
        />
        <span aria-hidden className="absolute inset-0 rounded-2xl brightness-90 dark:brightness-75">
          <span aria-hidden className="absolute inset-0 rounded-2xl bg-background" />
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl animate-[sandbox-border-shift_8s_ease-in-out_infinite]"
            style={{
              background: `linear-gradient(115deg, transparent 0%, transparent 32%, oklch(0.78 ${SUNLIGHT_C_SOFT} ${SHOWCASE_SUNLIGHT_HUE} / 0.22) 42%, oklch(0.68 ${SUNLIGHT_C_MID} ${SHOWCASE_SUNLIGHT_HUE} / 0.28) 50%, oklch(0.78 ${SUNLIGHT_C_SOFT} ${SHOWCASE_SUNLIGHT_HUE} / 0.22) 58%, transparent 68%, transparent 100%)`,
              backgroundSize: "200% 200%",
              backgroundPosition: "0% 50%",
            }}
          />
          <span
            className={cn(
              "absolute inset-px rounded-[calc(1rem-1px)]",
              glass(),
              "border border-white/20 dark:border-white/10",
              "transition-colors duration-300",
              "group-hover/showcase:border-[oklch(0.72_0.09_75/0.14)] group-hover/showcase:bg-[oklch(0.72_0.09_75/0.02)]",
              "dark:group-hover/showcase:border-[oklch(0.72_0.09_75/0.2)] dark:group-hover/showcase:bg-[oklch(0.72_0.09_75/0.04)]"
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-500",
              "group-hover/showcase:opacity-[0.35]"
            )}
            style={{
              background: `oklch(${SUNLIGHT_L} ${SUNLIGHT_C} ${SHOWCASE_SUNLIGHT_HUE} / 0.15)`,
            }}
          />
        </span>
        <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
          <span
            aria-hidden
            className="flex items-center gap-2.5 text-secondary-foreground text-sm mix-blend-multiply"
          >
            Showcase
            <ArrowSvg className="h-4 w-4 shrink-0" />
          </span>
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-start gap-2.5 text-secondary-background text-sm mix-blend-screen"
          >
            Showcase
            <ArrowSvg className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover/showcase:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
