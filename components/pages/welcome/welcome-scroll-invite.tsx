"use client";

import { useReducedMotion } from "framer-motion";

import { welcomeCopy } from "@/lib/welcome/copy";

type WelcomeScrollInviteProps = {
  targetId?: string;
  onScrollClick?: () => void;
  className?: string;
};

export function WelcomeScrollInvite({
  targetId = "welcome-features",
  onScrollClick,
  className,
}: WelcomeScrollInviteProps) {
  const reduce = useReducedMotion();

  const handleClick = () => {
    if (onScrollClick) {
      onScrollClick();

      return;
    }
    document.getElementById(targetId)?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <button
      aria-label={welcomeCopy.scrollInvite.label}
      className={className}
      type="button"
      onClick={handleClick}
    >
      {welcomeCopy.scrollInvite.text}
    </button>
  );
}
