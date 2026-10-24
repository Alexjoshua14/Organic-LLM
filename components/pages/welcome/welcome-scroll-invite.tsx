"use client";

import { useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import styles from "./welcome-specimen.module.css";

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
      <span>{welcomeCopy.scrollInvite.text}</span>
      <span aria-hidden className={styles.scrollCue}>
        <ChevronDown size={18} strokeWidth={1.25} />
      </span>
    </button>
  );
}
