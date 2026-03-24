"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { loading as loadingTokens, sectionLabel } from "@/lib/rabbit-holes/tokens";

interface RabbitHoleLoadingStateProps {
  message?: string;
  variant?: "initial" | "branch" | "article" | "sources";
  preview?: string | null;
}

const loadingMessages = {
  initial: "Starting your exploration...",
  branch: "Going deeper down the rabbit hole...",
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
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-fit min-h-[220px] gap-6 pointer-events-none"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <Loader2 className={loadingTokens.spinner} />
      </motion.div>
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className={loadingTokens.message}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.1 }}
      >
        {displayMessage}
      </motion.p>

      {preview && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
            <p className={cn(sectionLabel, "mb-3")}>Preview</p>
            <p className={loadingTokens.previewBody}>{preview}</p>
          </div>
        </motion.div>
      )}

      {/* Condensed skeleton loader */}
      <div className="w-full max-w-xl space-y-4 mt-4">
        <div className="space-y-3">
          <div className="h-3 w-28 bg-border rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-3 bg-border rounded animate-pulse"
                style={{
                  width: `${88 - i * 8}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <div className="h-5 w-2/3 bg-border rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-3 bg-border rounded animate-pulse"
                style={{
                  width: `${96 - i * 6}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <div className="h-4 w-1/2 bg-border rounded animate-pulse mt-4" />
        </div>
      </div>
    </motion.div>
  );
}
