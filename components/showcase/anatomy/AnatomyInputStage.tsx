"use client";

import type { InputIntentStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";

import { useAnatomyMotion } from "./anatomy-motion";
import { ToolChip } from "./tool-chip";

import { glass } from "@/components/design-system/primitives";
import { ChatModels } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

export function AnatomyInputStage({ stage }: { stage: InputIntentStage }) {
  const { staggerContainer, staggerItem } = useAnatomyMotion();
  const a = stage.artifact;
  const selected = ChatModels.find((m) => m.id === a.selectedModelId);
  const orderedModels =
    selected != null
      ? [selected, ...ChatModels.filter((m) => m.id !== selected.id)]
      : [...ChatModels];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Model for this turn
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {orderedModels.map((m) => {
            const active = m.id === a.selectedModelId;

            return (
              <div
                key={m.id}
                className={cn(
                  "min-w-[7.5rem] shrink-0 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  glass(),
                  active
                    ? "border-amber-400/50 bg-amber-500/10 ring-1 ring-amber-400/30"
                    : "border-border/50 opacity-70 hover:opacity-100"
                )}
              >
                <div className="text-xs font-medium leading-tight text-foreground">{m.name}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {m.id}
                </div>
              </div>
            );
          })}
        </div>
        {selected ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Selected for this turn:{" "}
            <span className="font-medium text-foreground">{selected.name}</span>
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Enabled tools
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
