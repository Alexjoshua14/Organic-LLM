"use client";

import type { KanbanCommand } from "@/lib/schemas/kanban";

import { useEffect, useMemo, useRef } from "react";

import { ChatThread } from "@/components/chat/chat-thread";
import { KanbanView } from "@/components/chat/kanban/KanbanView";
import { ErgonChannelLog } from "@/components/showcase/ergon/ErgonChannelLog";
import { ReplayComposer } from "@/components/showcase/replay/ReplayComposer";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useReplayClock } from "@/components/showcase/replay/use-replay-clock";
import { glass } from "@/components/design-system/primitives";
import {
  Conversation,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";
import { applyKanbanCommand, resetKanbanBoard, useKanbanBoard } from "@/lib/kanban/store";
import {
  ERGON_FULL_BOARD_VIEW,
  ERGON_SHOWCASE_THREAD_ID,
  ergonShowcaseSession,
} from "@/lib/showcase/ergon-session";
import {
  chapterStartTimes,
  compileReplay,
  deriveReplayFrame,
  replayEffects,
} from "@/lib/showcase/replay-timeline";
import { cn } from "@/lib/utils";

const THREAD_ID = ERGON_SHOWCASE_THREAD_ID;

const compiled = compileReplay(ergonShowcaseSession);
const effects = replayEffects(compiled) as KanbanCommand[];
const chapterStarts = chapterStartTimes(compiled);

export function ErgonShowcaseStage({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const appliedRef = useRef(0);
  const board = useKanbanBoard(THREAD_ID);

  const clock = useReplayClock({
    durationMs: compiled.durationMs,
    stageRef,
    loop: true,
    autoplay: true,
  });

  const frame = useMemo(() => deriveReplayFrame(compiled, clock.tMs), [clock.tMs]);

  const appliedCommands = effects.slice(0, frame.effectsApplied);
  const chapter = ergonShowcaseSession.chapters[frame.chapterIndex]!;

  // Sync kanban store with derived effects; reset on rewind / unmount.
  useEffect(() => {
    resetKanbanBoard(THREAD_ID);
    appliedRef.current = 0;

    return () => {
      resetKanbanBoard(THREAD_ID);
      appliedRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (frame.effectsApplied < appliedRef.current) {
      resetKanbanBoard(THREAD_ID);
      appliedRef.current = 0;
    }
    for (let i = appliedRef.current; i < frame.effectsApplied; i++) {
      applyKanbanCommand(THREAD_ID, effects[i]!);
    }
    appliedRef.current = frame.effectsApplied;
  }, [frame.effectsApplied]);

  const progress = compiled.durationMs > 0 ? frame.tMs / compiled.durationMs : 0;

  return (
    <div ref={stageRef} className={cn("flex flex-col gap-4", className)}>
      {/* Side-by-side only once the board track fits four 11rem columns; stacked below that. */}
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
        <div
          className={cn(
            "flex h-[min(560px,62dvh)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 shadow-sm",
            glass({ border: "none", opaque: true })
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Conversation</span>
            <span className="rounded-full border border-border/50 bg-background-tertiary/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Arcadia · Ergon
            </span>
          </div>
          <Conversation className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <ChatThread
              chatId={THREAD_ID}
              className="min-h-0 flex-1"
              contentClassName="pb-4 pt-4"
              messages={frame.messages}
              showActions={false}
              status={frame.status}
              aiActionPayload={frame.aiActionPayload}
              renderEmptyState={() => (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <p className="text-sm font-medium text-foreground/80">New Ergon thread</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Scripted replay — the composer will type a launch-week plan.
                  </p>
                </div>
              )}
            />
            <ConversationScrollButton className="bottom-3" />
          </Conversation>
          <div className="shrink-0 border-t border-border/50 p-3">
            <ReplayComposer showCaret={frame.composerText.length > 0} text={frame.composerText} />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-20">
          <div
            className={cn(
              "rounded-2xl border border-border/70 p-3 shadow-sm",
              glass({ border: "none", opaque: true })
            )}
          >
            <p className="mb-2 text-xs font-medium text-muted-foreground">Live board</p>
            {board ? (
              <KanbanView threadId={THREAD_ID} view={ERGON_FULL_BOARD_VIEW} />
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 px-3 py-10 text-center text-xs text-muted-foreground">
                Board appears when INITIATE_KANBAN lands.
              </div>
            )}
          </div>
          <ErgonChannelLog commands={appliedCommands} />
        </aside>
      </div>

      <ReplayControls
        caption={chapter.caption}
        chapterIndex={frame.chapterIndex}
        chapters={ergonShowcaseSession.chapters.map((c) => ({ id: c.id, title: c.title }))}
        playing={clock.playing}
        progress={progress}
        onPause={clock.pause}
        onPlay={clock.play}
        onRestart={clock.restart}
        onSeekChapter={(index) => {
          const start = chapterStarts[index] ?? 0;

          clock.seek(start);
          if (!clock.reduceMotion) clock.play();
        }}
      />
    </div>
  );
}
