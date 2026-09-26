"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Layers3, Play, X } from "lucide-react";

import { SubagentCard } from "./subagent-card";
import { SubagentDetail } from "./subagent-detail";
import { useArcadiaMultitask } from "./multitask-provider";
import { VoiceRosterLegend } from "./voice-roster-legend";

import { glass } from "@/components/design-system/primitives";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { cn } from "@/lib/utils";

/**
 * Idle-roster Multitask drawer. When any subagent is running, {@link MultitaskDashboard}
 * takes over layout instead — this overlay must not fight that mode.
 */
export function ArcadiaMultitaskShell() {
  const reduceMotion = useReducedMotion();
  const voice = useVoiceSessionOptional();
  const {
    agents,
    selected,
    selectedId,
    speakBinding,
    shellOpen,
    setShellOpen,
    selectAgent,
    speakTo,
    tickDemo,
  } = useArcadiaMultitask();

  const speakDisabled = !voice || voice.connecting;

  return (
    <>
      <button
        aria-expanded={shellOpen}
        aria-controls="arcadia-multitask-shell"
        className={cn(
          glass({ tone: "brown", opaque: true }),
          "fixed z-30 flex items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs font-medium shadow-lg",
          "top-[max(4.5rem,env(safe-area-inset-top,0px))] right-3 md:right-5",
          "hover:bg-background-secondary transition-colors"
        )}
        type="button"
        onClick={() => setShellOpen(!shellOpen)}
      >
        <Layers3 aria-hidden className="size-3.5" />
        Multitask
        <span className="rounded-md bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {agents.filter((a) => a.status === "working").length} live
        </span>
      </button>

      <AnimatePresence>
        {shellOpen ? (
          <motion.div
            key="multitask-shell"
            id="arcadia-multitask-shell"
            className={cn(
              "fixed z-30 flex flex-col",
              "top-[max(7rem,calc(env(safe-area-inset-top,0px)+5.5rem))] bottom-24 md:bottom-28",
              "right-2 left-2 sm:left-auto sm:right-4 sm:w-[min(42rem,calc(100vw-2rem))]"
            )}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <div
              className={cn(
                glass({ tone: "brown", opaque: true }),
                "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 shadow-xl"
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">Arcadia multitask</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Sandbox roster — condensed main characters, not a production swarm.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-[11px] hover:bg-background/50"
                    title="Advance demo progress once"
                    type="button"
                    onClick={() => tickDemo()}
                  >
                    <Play aria-hidden className="size-3" />
                    Tick
                  </button>
                  <button
                    aria-label="Close multitask shell"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-background/50"
                    type="button"
                    onClick={() => setShellOpen(false)}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              </header>

              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <div className="min-h-0 space-y-3 overflow-y-auto border-b border-border/40 p-3 md:border-b-0 md:border-r">
                  {agents.map((agent) => (
                    <SubagentCard
                      key={agent.id}
                      agent={agent}
                      selected={selectedId === agent.id}
                      speakDisabled={speakDisabled}
                      speaking={speakBinding?.agentId === agent.id && !!voice?.connected}
                      onSelect={() => selectAgent(agent.id)}
                      onSpeakTo={() => void speakTo(agent.id)}
                    />
                  ))}
                  <VoiceRosterLegend />
                </div>

                <div className="min-h-0 p-3">
                  {selected ? (
                    <SubagentDetail
                      agent={selected}
                      speakDisabled={speakDisabled}
                      speaking={speakBinding?.agentId === selected.id && !!voice?.connected}
                      onClose={() => selectAgent(null)}
                      onSpeakTo={() => void speakTo(selected.id)}
                    />
                  ) : (
                    <div
                      className={cn(
                        glass({ opaque: true }),
                        "flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 px-6 text-center"
                      )}
                    >
                      <p className="text-sm font-medium">Select a subagent</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Open their thread for goal and milestones, or Speak to start a new Realtime
                        session in their voice.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
