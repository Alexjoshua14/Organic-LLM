"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";

import { HOVER_SPRING } from "@/components/pages/welcome/welcome-motion";
import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

const signInGhostClass =
  "cursor-pointer rounded-full text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:hover:bg-muted/30";

type SignedOutAuthButtonsProps = {
  className?: string;
  size?: "default" | "compact";
  align?: "center" | "start";
};

export function SignedOutAuthButtons({
  className,
  size = "default",
  align = "center",
}: SignedOutAuthButtonsProps) {
  const compact = size === "compact";
  const reduce = useReducedMotion();
  const primaryMotion = reduce
    ? {}
    : {
        transition: HOVER_SPRING,
        whileHover: { scale: 1.015 },
        whileTap: { scale: 0.985 },
      };

  const rowAlign = align === "start" ? "justify-start" : "justify-center";
  const signInClass = cn(signInGhostClass, compact ? "h-9 px-4" : "h-10 px-5");

  return (
    <div className={cn("flex flex-wrap items-center gap-3", rowAlign, className)}>
      <SignUpButton mode="modal">
        <motion.button
          className={cn(
            "cursor-pointer rounded-full bg-accent font-medium text-accent-foreground shadow-sm hover:bg-accent/90",
            compact ? "h-9 px-4 text-sm" : "h-10 px-6 text-sm tracking-tight"
          )}
          type="button"
          {...primaryMotion}
        >
          {welcomeCopy.cta.signUp}
        </motion.button>
      </SignUpButton>
      <SignInButton mode="modal">
        <button className={signInClass} type="button">
          {welcomeCopy.cta.signIn}
        </button>
      </SignInButton>
    </div>
  );
}
