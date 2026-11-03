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
  /** Set on the subagent whose thread is open: clicking it goes here (the orchestrator). */
  returnHref?: string;
  onReturn?: () => void;
  onSpeakTo: () => void;
  onEndSpeak: () => void;
  speakDisabled?: boolean;
};

/*
 * Hover motion. The mark travels furthest, so it gets the longest ease (400ms); fill and text
 * follow in 300ms. Both sit inside the 250-400ms standard-enter range in
 * docs/design/motion-and-text-timing.md, on the same curve as the Speak bar, and stop under
 * reduced motion.
 */
const HOVER_EASE = "ease-[cubic-bezier(0.25,0.46,0.45,0.94)] motion-reduce:transition-none";
const MARK_MOTION = `transition-transform duration-400 ${HOVER_EASE}`;
const TEXT_MOTION = `duration-300 ${HOVER_EASE}`;

/*
 * Lumen: the app's warm glow colour as a soft halo, with no ring or outline. Keyboard focus gets
 * the stronger halo; selection holds the softer one.
 */
const LUMEN_FOCUS =
  "focus-visible:outline-none focus-visible:shadow-[0_0_16px_2px_rgb(var(--lumen)/0.42)]";
const LUMEN_SELECTED = "shadow-[0_0_12px_1px_rgb(var(--lumen)/0.2)]";

/**
 * CURRENT version. Design changes go to the Next fork in app/sandbox/subagents/cards, not here;
 * "promote" copies Next over this file. See docs/design/subagent-card-lab.md.
 *
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
  returnHref,
  onReturn,
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
      fillHeight={!speaking}
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
        glass({ border: "none" }),
        "group/card relative isolate cursor-pointer select-none rounded-xl p-3 pb-2 transition-[background-color,box-shadow]",
        TEXT_MOTION,
        // The mark grows to most of the card's height on hover, press, selection and live call.
        // Full height would be (p-3 top + 50px mark + pb-2 bottom) / 50px = 1.4; 1.3 stays inside.
        // The mark sits 2px below the card's centre (12px top padding, 8px bottom), so it scales
        // about 63% down: that origin puts the grown mark's centre on the card's centre at 1.3.
        // Hover and press also lift the card's glass fill, and the name and type respond. All
        // colour, weight and scale, so no layout shift. Speak opts out of all of it.
        "hover:not-has-[[data-speak-glass-bar]:hover]:bg-background/45",
        "active:not-has-[[data-speak-glass-bar]:active]:bg-background/60",
        selected && LUMEN_SELECTED
      )}
    >
      {agent.threadId ? (
        <Link
          aria-label={
            returnHref ? `Back to orchestrator from ${agent.name}` : `Open ${agent.name}'s thread`
          }
          className={`absolute inset-0 z-10 cursor-pointer rounded-xl transition-shadow ${TEXT_MOTION} ${LUMEN_FOCUS}`}
          href={returnHref ?? `/sandbox/arcadia/${agent.threadId}`}
          // Opening a thread also points the composer at it; the toggle must not undo that.
          onClick={returnHref ? onReturn : selected ? undefined : onSelect}
        />
      ) : (
        <button
          aria-label={`View ${agent.name}`}
          aria-pressed={selected}
          className={`absolute inset-0 z-10 cursor-pointer rounded-xl transition-shadow ${TEXT_MOTION} ${LUMEN_FOCUS}`}
          type="button"
          onClick={onSelect}
        />
      )}
      <div className="pointer-events-none relative z-20 flex items-center gap-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start gap-3">
            <SubagentIdentityMark
              className={cn(
                "size-[50px] origin-[50%_63%]",
                MARK_MOTION,
                "group-[:hover:not(:has([data-speak-glass-bar]:hover))]/card:scale-[1.3] group-[:active:not(:has([data-speak-glass-bar]:active))]/card:scale-[1.3]",
                (selected || speaking) && "scale-[1.3]"
              )}
              imageUrl={agent.identityImageUrl}
              name={agent.name}
              seed={agent.activitySeed ?? agent.id}
              state={agent.status === "done" ? "complete" : agent.status}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`truncate font-normal leading-tight tracking-tight text-foreground transition-[font-weight] ${TEXT_MOTION} group-[:hover:not(:has([data-speak-glass-bar]:hover))]/card:font-medium`}
                    >
                      {agent.name}
                    </h3>
                    {speaking ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        <Radio aria-hidden className="size-3" />
                        Live
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-px text-[10px] leading-tight uppercase tracking-wide text-muted-foreground/60 transition-colors ${TEXT_MOTION} group-[:hover:not(:has([data-speak-glass-bar]:hover))]/card:text-muted-foreground/85`}
                  >
                    {agent.role}
                  </p>
                  <p
                    className="mt-px truncate text-[10px] leading-tight text-muted-foreground/60"
                    title={agent.modelId ?? undefined}
                  >
                    {modelName ?? (agent.threadId ? "Not recorded" : "Not assigned")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {!speaking ? (
          <div className="pointer-events-auto -mr-1 w-14 shrink-0 self-stretch">{speakBar}</div>
        ) : null}
      </div>
      {speaking ? <div className="relative z-20 mt-2">{speakBar}</div> : null}
    </article>
  );
}
