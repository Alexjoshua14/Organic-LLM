"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { glass } from "@/components/design-system/primitives";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useShowcaseReplay } from "@/components/showcase/replay/use-showcase-replay";
import { useOptInSyntheticVoice } from "@/components/showcase/voice/synthetic-voice-stream";
import { VoiceLiveBar } from "@/components/voice/voice-live-bar";
import { scriptChapterSettledTimes, scriptChapterStarts } from "@/lib/showcase/scripted-timeline";
import {
  deriveVoiceDemo,
  selectVoiceStream,
  voiceDemoScript,
  type VoiceDemoPhase,
} from "@/lib/showcase/voice/script";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<VoiceDemoPhase, string> = {
  idle: "Voice is on",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const chapterStarts = scriptChapterStarts(voiceDemoScript);
const chapterSettledTimes = scriptChapterSettledTimes(voiceDemoScript);

export function VoiceShowcaseStage({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const audio = useOptInSyntheticVoice();
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const replay = useShowcaseReplay({
    durationMs: voiceDemoScript.durationMs,
    chapterStarts,
    chapterSettledTimes,
    stageRef,
    loop: false,
    autoplay: false,
    initialTimeMs: voiceDemoScript.durationMs,
  });

  const frame = useMemo(() => deriveVoiceDemo(replay.tMs), [replay.tMs]);
  const slot = selectVoiceStream(frame.phase, audio.enabled);
  const localStream = slot === "local" ? audio.stream : null;
  const remoteStream = slot === "remote" ? audio.stream : null;

  useEffect(() => {
    setStartedAt(Date.now());
  }, [replay.resetKey]);

  const onEnd = useCallback(() => {
    audio.disable();
    replay.restart();
  }, [audio.disable, replay.restart]);

  return (
    <div ref={stageRef} className={cn("flex flex-col gap-4", className)}>
      <section
        aria-label="Scripted transcript"
        className={cn(
          "rounded-2xl border border-border/60 p-4 shadow-sm sm:p-5",
          glass({ border: "none" })
        )}
      >
        <p className="text-sm leading-relaxed text-foreground/85">
          In the field at night, hands on the tripod.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          These lines are scripted.
        </p>

        {frame.lines.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The question will appear here as the demo listens.
          </p>
        ) : (
          <ol className="mt-4 flex list-none flex-col gap-3 p-0">
            {frame.lines.map((line) => (
              <li key={line.role} className="min-w-0" data-voice-line={line.role}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {line.role === "user" ? "You" : "Assistant"}
                </p>
                <p className="mt-1 text-sm leading-relaxed break-words text-foreground">
                  {line.text}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-foreground" data-voice-demo-phase={frame.phase}>
          {PHASE_LABEL[frame.phase]}
        </p>
        <button
          aria-describedby="voice-waveform-hint"
          aria-pressed={audio.enabled}
          className={cn(
            "inline-flex min-h-11 w-full items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors sm:w-auto",
            audio.enabled
              ? "border-amber-400/70 bg-amber-400/25 text-foreground shadow-sm"
              : "border-border/60 bg-background/30 text-foreground/80 hover:border-border hover:text-foreground"
          )}
          type="button"
          onClick={audio.toggle}
        >
          {audio.enabled ? "Waveform audio on" : "Turn on waveform audio"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground" id="voice-waveform-hint">
        Generated audio for the waveform only. Off until you turn it on. No microphone and no live
        session.
      </p>

      <div className="w-full min-w-0 overflow-hidden rounded-xl">
        <VoiceLiveBar
          key={replay.resetKey}
          connecting={false}
          localStream={localStream}
          phase={frame.phase}
          remoteStream={remoteStream}
          startedAt={startedAt}
          onEnd={onEnd}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        End restarts this scripted exchange and turns waveform audio off.
      </p>

      <ReplayControls
        caption={frame.chapter.caption}
        chapterIndex={frame.chapter.index}
        chapters={voiceDemoScript.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
        }))}
        playing={replay.playing}
        progress={replay.progress}
        reduceMotion={replay.reduceMotion}
        onPause={replay.pause}
        onPlay={replay.play}
        onRestart={replay.restart}
        onSeekChapter={replay.seekChapter}
      />
    </div>
  );
}
