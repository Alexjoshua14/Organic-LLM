"use client";

import type { ContextLoadStage, ContextPackStep } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";
import { Database, FileText, Layers, Scissors } from "lucide-react";

import { useAnatomyMotion } from "./anatomy-motion";

import { glass } from "@/components/design-system/primitives";
import { ChatModels } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

function StepIcon({ kind }: { kind: ContextPackStep["kind"] }) {
  switch (kind) {
    case "load_thread":
      return <Layers className="size-4 text-amber-500/90" />;
    case "attach_summary":
      return <FileText className="size-4 text-sky-500/90" />;
    case "attach_memories":
      return <Database className="size-4 text-emerald-500/90" />;
    case "trim":
      return <Scissors className="size-4 text-muted-foreground" />;
    default:
      return null;
  }
}

export function AnatomyContextStage({ stage }: { stage: ContextLoadStage }) {
  const { staggerContainer, staggerItem } = useAnatomyMotion();
  const a = stage.artifact;
  const selected = ChatModels.find((m) => m.id === a.selectedModelId);
  const budgetRatio = Math.min(1, a.budget.usedByContextPack / a.budget.contextWindowTokens);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Incoming turn
        </h3>
        <div
          className={cn(
            "rounded-xl border border-border/60 p-4 text-sm leading-relaxed text-foreground",
            glass()
          )}
        >
          {a.incomingMessage}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Model selection
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ChatModels.map((m) => {
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
            <span className="text-foreground font-medium">{selected.name}</span>
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Context pack
        </h3>
        <motion.ol
          className="relative space-y-0 border-l border-border/60 pl-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          {a.contextPackSteps.map((step, i) => (
            <motion.li key={i} className="relative pb-5 last:pb-0" variants={staggerItem}>
              <span className="absolute -left-[21px] top-0.5 flex size-7 items-center justify-center rounded-full border border-border/60 bg-background">
                <StepIcon kind={step.kind} />
              </span>
              <div className="pl-2">
                {step.kind === "load_thread" ? (
                  <>
                    <div className="text-sm font-medium text-foreground">{step.label}</div>
                    {step.detail ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{step.detail}</div>
                    ) : null}
                  </>
                ) : null}
                {step.kind === "attach_summary" ? (
                  <>
                    <div className="text-sm font-medium text-foreground">
                      {step.label ?? "Rolling summary"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      ~{step.tokenCount} tokens attached
                    </div>
                  </>
                ) : null}
                {step.kind === "attach_memories" ? (
                  <>
                    <div className="text-sm font-medium text-foreground">
                      Memories merged into pack
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {step.items.map((it) => (
                        <li
                          key={it.id ?? it.label}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border border-border/40 px-2 py-1.5 text-xs",
                            glass()
                          )}
                        >
                          <span className="text-foreground">{it.label}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            ~{it.tokens} tok
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {step.kind === "trim" ? (
                  <>
                    <div className="text-sm font-medium text-foreground">{step.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{step.reason}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      ~{step.estimatedTokens} tokens dropped
                    </div>
                  </>
                ) : null}
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Window budget
        </h3>
        <div className={cn("rounded-xl border border-border/50 p-3", glass())}>
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Context pack</span>
            <span className="font-mono">
              {a.budget.usedByContextPack.toLocaleString()} /{" "}
              {a.budget.contextWindowTokens.toLocaleString()} tok
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/40">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-amber-500/80 to-amber-400/50"
              initial={false}
              animate={{ width: `${budgetRatio * 100}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Reserved for completion:{" "}
            <span className="font-mono text-foreground/90">
              {a.budget.reservedForCompletion.toLocaleString()} tok
            </span>
            {" · "}
            Last-N turns in view: <span className="font-mono">{a.lastNTurns}</span>
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trimmed from pack
        </h3>
        <ul className="space-y-2">
          {a.excluded.map((row) => (
            <li
              key={row.label}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border border-dashed border-border/50 px-3 py-2 text-xs",
                glass()
              )}
            >
              <span className="font-medium text-foreground/90">{row.label}</span>
              <span className="text-muted-foreground">{row.reason}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                ~{row.estimatedTokens} tokens
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
