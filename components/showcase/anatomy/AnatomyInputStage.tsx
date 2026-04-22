"use client";

import type { InputIntentStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";
import { Hash } from "lucide-react";

import { useAnatomyMotion } from "./anatomy-motion";
import { ToolChip } from "./tool-chip";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function AnatomyInputStage({ stage }: { stage: InputIntentStage }) {
  const { staggerContainer, staggerItem } = useAnatomyMotion();
  const a = stage.artifact;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Raw message
        </h3>
        <div
          className={cn(
            "rounded-xl border border-border/60 p-4 text-sm leading-relaxed text-foreground",
            glass()
          )}
        >
          {a.rawMessage}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground",
            glass()
          )}
        >
          <Hash className="size-3.5 shrink-0" />~{a.tokenEstimate} tokens estimated
        </span>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Available tools
        </h3>
        <motion.div
          className="flex flex-wrap gap-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {a.availableTools.map((t) => (
            <motion.div key={t} variants={staggerItem}>
              <ToolChip toolName={t} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
