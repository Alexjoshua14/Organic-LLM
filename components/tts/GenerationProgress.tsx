"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Check, Clock, Zap } from "lucide-react";

type GenerationProgressProps = {
  isActive: boolean;
  estimatedDurationMs: number;
  segmentIndex?: number;
  totalSegments?: number;
  stage?: "transforming" | "generating";
  className?: string;
};

export function GenerationProgress({
  isActive,
  estimatedDurationMs,
  segmentIndex,
  totalSegments,
  stage = "generating",
  className = "",
}: GenerationProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isActive && !startTime) {
      setStartTime(Date.now());
      setElapsedMs(0);
    } else if (!isActive) {
      setStartTime(null);
      setElapsedMs(0);
    }
  }, [isActive, startTime]);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  if (!isActive) return null;

  const progress = Math.min((elapsedMs / estimatedDurationMs) * 100, 95); // Cap at 95% until complete
  const remainingMs = Math.max(estimatedDurationMs - elapsedMs, 0);
  const remainingSec = Math.ceil(remainingMs / 1000);

  const formatRemaining = () => {
    if (remainingSec <= 0) return "Almost done...";
    if (remainingSec < 60) return `~${remainingSec}s remaining`;
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    return `~${mins}m ${secs}s remaining`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <div className="absolute inset-0 blur-md bg-violet-400/30 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground/80">
              {stage === "transforming" ? "Enhancing text" : "Generating audio"}
            </p>
            {segmentIndex !== undefined && totalSegments !== undefined && (
              <p className="text-xs text-muted-foreground/50">
                Segment {segmentIndex + 1} of {totalSegments}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <Clock className="w-3.5 h-3.5" />
          {formatRemaining()}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/40">
        <span className="tabular-nums">{Math.round(progress)}% complete</span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {(elapsedMs / 1000).toFixed(1)}s elapsed
        </span>
      </div>
    </div>
  );
}

/**
 * Compact inline progress indicator
 */
export function InlineProgress({ 
  progress, 
  label 
}: { 
  progress: number; 
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-24 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
      {label && <span className="text-xs text-muted-foreground/50">{label}</span>}
    </div>
  );
}
