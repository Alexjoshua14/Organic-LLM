"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSpeakSessionPhase } from "@/lib/arcadia/multitask/speak-session";
import type { LiveVoicePhase } from "@/hooks/use-realtime-voice";

import Link from "next/link";
import { Radio } from "lucide-react";

import { SubagentSpeakGlassBar } from "./subagent-speak-glass-bar";

import { glass } from "@/components/design-system/primitives";
import { SubagentIdentityMark } from "@/components/agents/subagent-identity-mark";
import { cn } from "@/lib/utils";
import { getModelDisplayName } from "@/lib/chat/message-model";

type SubagentCardProps = {
  agent: ArcadiaSubagent;
  selected: boolean;
  speakPhase: ArcadiaSpeakSessionPhase;
  voicePhase: LiveVoicePhase;
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onSelect: () => void;
  onSpeakTo: () => void;
  onEndSpeak: () => void;
  speakDisabled?: boolean;
};

/**
 * Condensed main character for one active subagent — not a status chip, not a full page.
 */
export function SubagentCard({
  agent,
  selected,
  speakPhase,
  voicePhase,
  startedAt,
  localStream,
  remoteStream,
  onSelect,
  onSpeakTo,
  onEndSpeak,
  speakDisabled,
}: SubagentCardProps) {
  const speaking = speakPhase === "live" || speakPhase === "connecting";
  const modelName = getModelDisplayName(agent.modelId);

  const speakBar = (
    <SubagentSpeakGlassBar
      agentName={agent.name}
      disabled={speakDisabled}
      localStream={localStream}
      phase={speakPhase}
      remoteStream={remoteStream}
      startedAt={startedAt}
      voicePhase={voicePhase}
      onEnd={onEndSpeak}
      onSpeakTo={onSpeakTo}
    />
  );

  return (
    <article
      className={cn(
        glass(),
        "relative isolate cursor-pointer select-none rounded-xl border p-3 pb-2 transition-colors",
        selected
          ? "border-amber-700/40 dark:border-amber-200/25 ring-1 ring-amber-800/20"
          : "border-border/50 hover:border-border"
      )}
    >
      {agent.threadId ? (
        <Link
          aria-label={`Open ${agent.name}'s thread`}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          href={`/sandbox/arcadia/${agent.threadId}`}
        />
      ) : (
        <button
          aria-label={`View ${agent.name}`}
          aria-pressed={selected}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          type="button"
          onClick={onSelect}
        />
      )}
      <div className="pointer-events-none relative z-20 flex items-center gap-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start gap-3">
            <SubagentIdentityMark
              className="size-[50px]"
              imageUrl={agent.identityImageUrl}
              name={agent.name}
              seed={agent.activitySeed ?? agent.id}
              state={agent.status === "done" ? "complete" : agent.status}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold leading-tight tracking-tight text-foreground">
                      {agent.name}
                    </h3>
                    {speaking ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        <Radio aria-hidden className="size-3" />
                        Live
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-px text-[11px] leading-tight uppercase tracking-wide text-muted-foreground">
                    {agent.role}
                  </p>
                  <p
                    className="mt-px truncate text-[11px] leading-tight text-muted-foreground/70"
                    title={agent.modelId ?? undefined}
                  >
                    {modelName ?? (agent.threadId ? "Not recorded" : "Not assigned")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {!speaking ? <div className="pointer-events-auto w-14 shrink-0">{speakBar}</div> : null}
      </div>
      {speaking ? <div className="relative z-20 mt-2">{speakBar}</div> : null}
    </article>
  );
}
