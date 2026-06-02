"use client";

import { motion } from "framer-motion";

import { AiInputForm } from "@/components/chat-experimental/ai-input-form";
import { HomepagePrimaryActions } from "@/components/pages/homepage-primary-actions";
import { cn } from "@/lib/utils";

/** Mirrors {@link AIInput} compact (non–full-view) layout + springs — without routing or LLM. */
const HOME_INPUT_SPRING = { type: "spring" as const, stiffness: 220, damping: 30, mass: 0.95 };

const noopSubmit = async (_prompt: string) => {
  /* Morph sandbox: no homepage routing */
};

const noopStrata = async (_text: string) => {
  /* Morph sandbox: no Strata capture */
};

export function MorphDemoHomeInput({
  className,
  relaxMaxWidthWhileMorphing = false,
}: {
  className?: string;
  /** While true, drop the composer max-width cap so the shell tracks physics width (chat→home). */
  relaxMaxWidthWhileMorphing?: boolean;
}) {
  return (
    <motion.div
      layout
      className={cn("flex w-full flex-col gap-4", className)}
      tabIndex={-1}
      transition={{ ...HOME_INPUT_SPRING, layout: { ...HOME_INPUT_SPRING } }}
    >
      <AiInputForm
        className={cn(
          "w-full rounded-xl",
          relaxMaxWidthWhileMorphing ? "max-w-none" : "max-w-xl"
        )}
        clearAfterSubmit={false}
        fullView={false}
        isLoading={false}
        status="ready"
        submitStatus="ready"
        onStrataShortcut={noopStrata}
        onSubmit={noopSubmit}
      />
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 1, y: 0 }}
        transition={HOME_INPUT_SPRING}
      >
        <HomepagePrimaryActions />
      </motion.div>
    </motion.div>
  );
}
