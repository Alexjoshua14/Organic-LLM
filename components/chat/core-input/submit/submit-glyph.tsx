"use client";

import { motion } from "framer-motion";

export type OrganicSubmitState = "idle" | "ready" | "sent" | "awaiting" | "error";

export function OrganicSubmitGlyph({ state }: { state: OrganicSubmitState }) {
  const label = {
    idle: "Idle",
    ready: "Ready to send",
    sent: "Sent",
    awaiting: "Awaiting completion",
    error: "Error",
  }[state];

  return (
    <motion.svg
      aria-label={label}
      className="size-4"
      fill="none"
      initial={false}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {state === "idle" ? (
        <motion.g
          key="idle"
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.82 }}
          transition={{ duration: 0.18 }}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 5v1.5M12 17.5V19M5 12h1.5M17.5 12H19" opacity="0.55" />
        </motion.g>
      ) : null}
      {state === "ready" ? (
        <motion.path
          key="ready"
          animate={{ opacity: 1, pathLength: 1, y: 0 }}
          d="M12 19V5m0 0-6 6m6-6 6 6"
          initial={{ opacity: 0, pathLength: 0, y: 2 }}
          transition={{ duration: 0.22 }}
        />
      ) : null}
      {state === "sent" ? (
        <motion.path
          key="sent"
          animate={{ opacity: 1, pathLength: 1, scale: 1 }}
          d="m5 12 4 4L19 6"
          initial={{ opacity: 0, pathLength: 0, scale: 0.9 }}
          transition={{ duration: 0.24 }}
        />
      ) : null}
      {state === "awaiting" ? (
        <motion.g
          key="awaiting"
          animate={{ rotate: 360 }}
          initial={{ opacity: 0.9 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        >
          <path d="M12 4a8 8 0 0 1 8 8" />
          <path d="M20 12a8 8 0 0 1-8 8" opacity="0.45" />
          <circle cx="12" cy="12" r="2.5" />
        </motion.g>
      ) : null}
      {state === "error" ? (
        <motion.g
          key="error"
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.18 }}
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </motion.g>
      ) : null}
    </motion.svg>
  );
}
