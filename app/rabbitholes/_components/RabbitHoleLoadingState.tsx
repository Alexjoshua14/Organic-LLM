"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface RabbitHoleLoadingStateProps {
  message?: string;
  variant?: "initial" | "branch" | "article" | "sources";
  preview?: string | null;
}

const loadingMessages = {
  initial: "Starting your exploration...",
  branch: "Following the rabbit hole...",
  article: "Crafting your article...",
  sources: "Collecting sources...",
};

export function RabbitHoleLoadingState({
  message,
  variant = "initial",
  preview,
}: RabbitHoleLoadingStateProps) {
  const displayMessage = message || loadingMessages[variant];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center h-full min-h-[400px] gap-8 pointer-events-none"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <Loader2 className="w-8 h-8 text-[#5C5E5E] dark:text-[#A0A2A2]" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="font-satoshi text-[#5C5E5E] dark:text-[#A0A2A2] text-sm tracking-wide"
      >
        {displayMessage}
      </motion.p>

      {/* Quick preview if available */}
      {preview && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-2xl"
        >
          <div className="bg-white/50 dark:bg-[#1C1E1F]/50 backdrop-blur-sm border border-[#DCDDDC] dark:border-[#2A2C2D] rounded-lg p-6">
            <p className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] mb-3 font-light">
              Preview
            </p>
            <p className="font-satoshi text-[#2D2B26] dark:text-[#F3F4F3] text-base leading-relaxed">
              {preview}
            </p>
          </div>
        </motion.div>
      )}

      {/* Skeleton loader for article structure */}
      <div className="w-full max-w-2xl space-y-8 mt-8">
        {/* Key takeaways skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-32 bg-[#DCDDDC] dark:bg-[#2A2C2D] rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 bg-[#DCDDDC] dark:bg-[#2A2C2D] rounded animate-pulse"
                style={{
                  width: `${85 - i * 5}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Article skeleton */}
        <div className="space-y-6 pt-8">
          <div className="h-8 w-3/4 bg-[#DCDDDC] dark:bg-[#2A2C2D] rounded animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-4 bg-[#DCDDDC] dark:bg-[#2A2C2D] rounded animate-pulse"
                style={{
                  width: `${100 - i * 2}%`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <div className="h-6 w-1/2 bg-[#DCDDDC] dark:bg-[#2A2C2D] rounded animate-pulse mt-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 bg-[#DCDDDC] dark:bg-[#2A2C2D] rounded animate-pulse"
                style={{
                  width: `${95 - i * 3}%`,
                  animationDelay: `${(i + 4) * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

