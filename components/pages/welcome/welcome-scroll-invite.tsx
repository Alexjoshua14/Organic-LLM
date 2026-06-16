"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { WELCOME_EASE } from "./welcome-motion";

import { welcomeCopy } from "@/lib/welcome/copy";

type WelcomeScrollInviteProps = {
  targetId?: string;
  onScrollClick?: () => void;
};

/** 0 = hidden, 1 = visible static, 2 = visible pulsing */
type Phase = 0 | 1 | 2;

const HIDE_MS = 7000;
const STATIC_MS = 7000;

export function WelcomeScrollInvite({
  targetId = "welcome-features",
  onScrollClick,
}: WelcomeScrollInviteProps) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? 1 : 0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (reduce) return;

    const t1 = setTimeout(() => setPhase(1), HIDE_MS);
    const t2 = setTimeout(() => setPhase(2), HIDE_MS + STATIC_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduce]);

  useEffect(() => {
    const target = document.getElementById(targetId);

    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDismissed(true);
      },
      { threshold: 0.12 }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [targetId]);

  const handleClick = () => {
    setDismissed(true);
    if (onScrollClick) {
      onScrollClick();

      return;
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (dismissed) return null;

  const visible = phase > 0;

  return (
    <motion.button
      aria-hidden={!visible}
      aria-label={welcomeCopy.scrollInvite.label}
      className="cursor-pointer rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
      }}
      type="button"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{
        opacity: { duration: 0.4 },
        scale: { type: "spring", stiffness: 400, damping: 17 },
      }}
      whileHover={visible ? { scale: 1.05 } : undefined}
      whileTap={visible ? { scale: 0.98 } : undefined}
      onClick={handleClick}
    >
      <motion.span
        animate={phase === 2 && !reduce ? { y: [0, 5, 0] } : { y: 0 }}
        className="flex items-center justify-center"
        transition={
          phase === 2 && !reduce
            ? {
                duration: 1.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: WELCOME_EASE,
              }
            : { duration: 0.3 }
        }
      >
        <ChevronDown aria-hidden className="size-8 sm:size-9" strokeWidth={1.75} />
      </motion.span>
    </motion.button>
  );
}
