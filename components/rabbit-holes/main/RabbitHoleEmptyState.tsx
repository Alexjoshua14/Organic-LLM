"use client";

import { motion } from "framer-motion";
import { Rabbit } from "lucide-react";

interface RabbitHoleEmptyStateProps {
  /** Optional short headline override */
  title?: string;
  /** Optional supporting line override */
  subtitle?: string;
}

const defaultTitle = "Start exploring a topic";
const defaultSubtitle =
  "Enter a question below to begin your rabbit hole journey";

export function RabbitHoleEmptyState({
  title = defaultTitle,
  subtitle = defaultSubtitle,
}: RabbitHoleEmptyStateProps) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[280px] text-center px-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="rounded-2xl border border-border/50 bg-muted/20 p-6 mb-6"
      >
        <Rabbit
          className="w-10 h-10 text-muted-foreground/70"
          strokeWidth={1.25}
          aria-hidden
        />
      </motion.div>
      <p className="font-commissioner text-muted-foreground text-xl mb-3 font-light tracking-wide">
        {title}
      </p>
      <p className="text-muted-foreground/70 text-sm max-w-sm leading-relaxed">
        {subtitle}
      </p>
    </motion.div>
  );
}
