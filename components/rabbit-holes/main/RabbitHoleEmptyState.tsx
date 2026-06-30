"use client";

import { motion } from "framer-motion";
import { Rabbit } from "lucide-react";

import { FeatureHint } from "@/components/onboarding/feature-hint";
import { cn } from "@/lib/utils";

interface RabbitHoleEmptyStateProps {
  /** Optional short headline override */
  title?: string;
  /** Optional supporting line override */
  subtitle?: string;
  /** Hide desktop-only focus-mode hint */
  compact?: boolean;
}

const defaultTitle = "Start exploring a topic";
const defaultSubtitle = "Enter a question below to begin your rabbit hole journey";

export function RabbitHoleEmptyState({
  title = defaultTitle,
  subtitle = defaultSubtitle,
  compact = false,
}: RabbitHoleEmptyStateProps) {
  return (
    <FeatureHint id="rabbit-holes-focus" showWhen={!compact}>
      <motion.div
        key="empty"
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center px-8 text-center",
          compact && "min-h-[200px] px-5"
        )}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.35 }}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border/50 bg-muted/20 p-6 mb-6"
          initial={{ opacity: 0, scale: 0.96 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <Rabbit aria-hidden className="w-10 h-10 text-muted-foreground/70" strokeWidth={1.25} />
        </motion.div>
        <p className="font-commissioner text-muted-foreground text-xl mb-3 font-light tracking-wide">
          {title}
        </p>
        <p className="text-muted-foreground/70 text-sm max-w-sm leading-relaxed">{subtitle}</p>
        {!compact && (
          <p className="text-muted-foreground/55 mt-4 max-w-sm text-xs leading-relaxed">
            ⌘⇧F (Ctrl+Shift+F) toggles focus mode — hides the path, sources, and prompt for
            reading.
          </p>
        )}
      </motion.div>
    </FeatureHint>
  );
}
