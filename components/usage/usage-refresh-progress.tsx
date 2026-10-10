"use client";

import { useEffect, useState } from "react";

import styles from "./usage-refresh-progress.module.css";

export const USAGE_REFRESH_MS = 15_000;
const PROGRESS_TICK_MS = 1_000;

export function UsageRefreshProgress({
  refreshAt,
  loading,
}: {
  refreshAt: number | null;
  loading: boolean;
}) {
  const [remainingMs, setRemainingMs] = useState(USAGE_REFRESH_MS);

  useEffect(() => {
    if (refreshAt === null) return;

    const timer = window.setInterval(() => {
      setRemainingMs(Math.max(0, refreshAt - Date.now()));
    }, PROGRESS_TICK_MS);

    return () => window.clearInterval(timer);
  }, [refreshAt]);

  const progress = loading ? 1 : refreshAt === null ? 0 : 1 - remainingMs / USAGE_REFRESH_MS;
  const remainingSeconds = Math.ceil(remainingMs / 1_000);

  return (
    <div
      aria-label="Next usage refresh"
      aria-valuemax={USAGE_REFRESH_MS}
      aria-valuemin={0}
      aria-valuenow={loading ? undefined : Math.round(progress * USAGE_REFRESH_MS)}
      aria-valuetext={
        loading
          ? "Refreshing usage"
          : refreshAt === null
            ? "Automatic refresh is inactive"
            : `Next refresh in ${remainingSeconds} seconds`
      }
      className="h-px w-32 rounded-full bg-muted-foreground/15 text-muted-foreground/70"
      role="progressbar"
    >
      <div
        className={`${styles.fill} h-full origin-left rounded-full bg-[linear-gradient(90deg,transparent,currentColor_35%,currentColor)] shadow-[0_0_5px_currentColor]`}
        style={{
          transform: `scaleX(${progress})`,
          animationDuration: `${USAGE_REFRESH_MS}ms`,
          animationName: refreshAt !== null && !loading ? undefined : "none",
        }}
      />
    </div>
  );
}
