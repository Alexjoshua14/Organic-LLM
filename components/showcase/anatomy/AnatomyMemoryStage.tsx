"use client";

import type { MemorySearchStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";

import { useAnatomyMotion } from "./anatomy-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function AnatomyMemoryStage({ stage }: { stage: MemorySearchStage }) {
  const { staggerContainer, staggerItem } = useAnatomyMotion();
  const a = stage.artifact;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Query
        </span>
        <span
          className={cn(
            "inline-block max-w-full truncate rounded-full border border-border/60 px-3 py-1 text-xs text-foreground",
            glass()
          )}
        >
          {a.query}
        </span>
        <span className="text-xs text-muted-foreground">top-{a.topK}</span>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Injected into context
        </h3>
        <motion.ul
          className="space-y-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {a.injected.map((m) => (
            <motion.li
              key={m.id}
              variants={staggerItem}
              className={cn(
                "rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm leading-snug",
                glass()
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{m.id}</span>
                {m.score != null ? (
                  <span className="rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    {(m.score * 100).toFixed(0)}% match
                  </span>
                ) : null}
              </div>
              <p className="text-foreground/95">{m.memory}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filtered out
        </h3>
        <ul className="space-y-1.5">
          {a.filteredOut.map((f) => (
            <li
              key={f.id}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border border-border/40 px-3 py-2 text-xs text-muted-foreground",
                glass()
              )}
            >
              <span className="font-mono text-[10px] text-foreground/60">{f.id}</span>
              <span>{f.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
