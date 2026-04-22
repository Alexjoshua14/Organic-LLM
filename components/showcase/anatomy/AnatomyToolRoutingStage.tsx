"use client";

import type { ToolRoutingStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";
import { Monitor, Server } from "lucide-react";

import { useAnatomyMotion } from "./anatomy-motion";
import { ToolChip } from "./tool-chip";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function summarizeArgs(toolName: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const o = args as Record<string, unknown>;

  if (typeof o.query === "string") return o.query;
  if (typeof o.description === "string") return o.description;
  try {
    const s = JSON.stringify(args);

    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return "";
  }
}

export function AnatomyToolRoutingStage({ stage }: { stage: ToolRoutingStage }) {
  const { staggerContainer, staggerItem } = useAnatomyMotion();
  const a = stage.artifact;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-xl border border-border/50 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground",
          glass()
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
          Planner
        </span>
        <p className="mt-1.5 text-foreground/90">{a.modelNotes}</p>
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tool calls
      </h3>
      <motion.ul
        className="space-y-3"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {a.toolCalls.map((call) => {
          const summary = summarizeArgs(call.toolName, call.arguments);
          const server = call.execution === "server";

          return (
            <motion.li
              key={call.toolCallId}
              layout
              variants={staggerItem}
              className={cn("flex flex-col gap-2 rounded-xl border border-border/60 p-3", glass())}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <ToolChip toolName={call.toolName} size="sm" />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {call.toolCallId}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      server
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        : "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                    )}
                  >
                    {server ? <Server className="size-3" /> : <Monitor className="size-3" />}
                    {server ? "Server" : "Client"}
                  </span>
                  {call.latencyMs != null ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {call.latencyMs} ms
                    </span>
                  ) : null}
                </div>
              </div>
              {summary ? (
                <p className="text-xs leading-snug text-muted-foreground">{summary}</p>
              ) : null}
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
