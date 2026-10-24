"use client";

import type { TokenBudgetStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";

import { useAnatomyMotion } from "./anatomy-motion";

import { ChatAIAction } from "@/components/chat/chat-message";
import { glass } from "@/components/design-system/primitives";
import { ChatAIActionEnum } from "@/types/ai";
import { cn } from "@/lib/utils";

export function AnatomyStreamingStage({ stage }: { stage: TokenBudgetStage }) {
  const { staggerContainer, staggerItem } = useAnatomyMotion();
  const a = stage.artifact;
  const denom = a.promptTokens + a.maxOutputTokens;
  const fill = denom > 0 ? Math.min(0.94, a.promptTokens / denom) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Token meter
        </h3>
        <div className={cn("rounded-xl border border-border/50 p-3", glass())}>
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Prompt footprint ~<span className="font-mono text-foreground">{a.promptTokens}</span>{" "}
              tok
            </span>
            <span>
              Max completion <span className="font-mono text-foreground">{a.maxOutputTokens}</span>{" "}
              tok
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted/40">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-violet-500/85 to-sky-500/70"
              initial={{ width: 0 }}
              whileInView={{ width: `${fill * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Stream buffer target ~{a.streamBufferTargetChars} chars for smooth UI updates.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Live tail (aiAction stream)
        </h3>
        <motion.div
          className="space-y-0 [&>div]:mb-2 [&>div]:rounded-lg [&>div]:border [&>div]:border-border/40 [&>div]:p-2 [&>div]:last:mb-0"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
        >
          {a.aiActionTimeline.map((entry, i) => (
            <motion.div key={i} variants={staggerItem}>
              <ChatAIAction
                aiActionPayload={{
                  action: entry.action as ChatAIActionEnum,
                  message: entry.message,
                  sources: entry.sources,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Graceful finish hint
        </h3>
        <blockquote
          className={cn(
            "border-l-2 border-amber-400/50 pl-3 text-sm italic leading-relaxed text-muted-foreground",
            glass(),
            "rounded-r-lg py-2 pr-2"
          )}
        >
          {a.gracefulFinishInstruction}
        </blockquote>
      </div>
    </div>
  );
}
