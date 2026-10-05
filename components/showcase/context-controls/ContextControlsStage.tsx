"use client";

import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { ContextEffortLevel } from "@/lib/memory/context-effort";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  ContextBudgetIndicatorView,
  ContextBudgetPopover,
} from "@/components/chat/context-budget-indicator";
import {
  CoreInputControlsProvider,
  type CoreInputControlsValue,
} from "@/components/chat/core-input/core-input-context";
import { ComposerContextEffortSlider } from "@/components/chat/core-input/controls/context-effort-slider";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useShowcaseReplay } from "@/components/showcase/replay/use-showcase-replay";
import { glass } from "@/components/design-system/primitives";
import { formatTokenCount, segmentTokens } from "@/lib/chat/context-budget";
import { CONTEXT_EFFORT_BUDGETS } from "@/lib/memory/context-effort";
import {
  CONTEXT_DEMO_MODEL_ID,
  contextControlsScript,
  contextDemoBudget,
  contextDemoMemories,
  deriveContextDemo,
} from "@/lib/showcase/context-controls";
import { scriptChapterSettledTimes, scriptChapterStarts } from "@/lib/showcase/scripted-timeline";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import { getSelectableChatModels } from "@/lib/schemas/chat";
import { cn } from "@/lib/utils";

/** Same object `deriveContextDemo` closes over — compiled once, not inside the render. */
const script = contextControlsScript;

const SELECTABLE_MODELS = getSelectableChatModels(false);
const demoModel = SELECTABLE_MODELS.find((model) => model.id === CONTEXT_DEMO_MODEL_ID);

if (!demoModel) {
  throw new Error(`Context controls demo model ${CONTEXT_DEMO_MODEL_ID} is not selectable`);
}

const DEMO_MODEL = demoModel;

const HEAVY_MEMORY_CAP = CONTEXT_EFFORT_BUDGETS.heavy.combinedTokenCap;

type VisitorEffort = {
  resetKey: number;
  effort: ContextEffortLevel;
} | null;

export function ContextControlsStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const replay = useShowcaseReplay({
    durationMs: script.durationMs,
    chapterStarts: scriptChapterStarts(script),
    chapterSettledTimes: scriptChapterSettledTimes(script),
    stageRef,
    loop: false,
    autoplay: false,
    initialTimeMs: script.durationMs,
  });

  const frame = useMemo(() => deriveContextDemo(replay.tMs), [replay.tMs]);
  const [visitor, setVisitor] = useState<VisitorEffort>(null);
  const driven = visitor && visitor.resetKey === replay.resetKey ? visitor.effort : null;
  const effort = driven ?? frame.effort;
  const budget = driven ? contextDemoBudget(driven) : frame.budget;
  const memories = driven ? contextDemoMemories(driven) : frame.memories;
  const memoryTokens = segmentTokens(budget, "memory");

  const { takeover, resetKey } = replay;
  const onContextEffortChange = useCallback(
    (level: ContextEffortLevel) => {
      takeover();
      setVisitor({ resetKey, effort: level });
    },
    [resetKey, takeover]
  );

  const chapter = script.chapters[frame.chapterIndex]!;

  return (
    <div ref={stageRef} className="flex flex-col gap-4">
      <div className="showcase-context-grid grid grid-cols-1 items-start gap-4">
        <ContextEffortCard
          className="showcase-context-effort"
          effort={effort}
          memoryTokens={memoryTokens}
          visitorDriven={driven != null}
          onContextEffortChange={onContextEffortChange}
          onGrab={takeover}
        />
        <section
          aria-label="Context composition"
          className={cn(
            "showcase-context-inspector overflow-hidden rounded-xl border border-border/60",
            glass({ border: "none" })
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Context inspector
              </h2>
              <p className="text-[11px] text-muted-foreground">Breakdown for the next answer</p>
            </div>
            <ContextBudgetIndicatorView budget={budget} />
          </div>
          <ContextBudgetPopover budget={budget} />
        </section>
        <MemoryList className="showcase-context-memories" memories={memories} />
      </div>

      <ReplayControls
        caption={chapter.caption}
        chapterIndex={frame.chapterIndex}
        chapters={script.chapters}
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

function ContextEffortCard({
  effort,
  memoryTokens,
  visitorDriven,
  onContextEffortChange,
  onGrab,
  className,
}: {
  effort: ContextEffortLevel;
  memoryTokens: number;
  visitorDriven: boolean;
  onContextEffortChange: (level: ContextEffortLevel) => void;
  onGrab: () => void;
  className?: string;
}) {
  const levelName = CONTEXT_EFFORT_BUDGETS[effort].name;
  const fill = Math.min(100, Math.max(0, (memoryTokens / HEAVY_MEMORY_CAP) * 100));

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 p-3 shadow-sm sm:p-4",
        glass({ border: "none" }),
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Context effort
          </h2>
          <p aria-live="polite" className="mt-0.5 text-sm text-foreground">
            {levelName}
          </p>
        </div>
        <div onPointerDown={onGrab}>
          <EffortSliderBridge effort={effort} onContextEffortChange={onContextEffortChange} />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">Memory token budget</p>
        <p className="font-mono text-lg tabular-nums text-foreground">
          {formatTokenCount(memoryTokens)}
        </p>
      </div>
      <div
        aria-label="Memory token budget"
        aria-valuemax={HEAVY_MEMORY_CAP}
        aria-valuemin={0}
        aria-valuenow={memoryTokens}
        aria-valuetext={`${memoryTokens.toLocaleString()} memory tokens at ${levelName}, against Heavy's ${HEAVY_MEMORY_CAP.toLocaleString()} token cap`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/50"
        role="meter"
      >
        <div
          className="h-full rounded-full bg-amber-400/85 motion-safe:transition-[width] motion-safe:duration-150 motion-reduce:transition-none"
          style={{ width: `${fill}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Against Heavy&apos;s {formatTokenCount(HEAVY_MEMORY_CAP)} cap
        {" · "}
        <EffortScaleMark current={effort} level="instant" />
        {" · "}
        <EffortScaleMark current={effort} level="quick" />
        {" · "}
        <EffortScaleMark current={effort} level="heavy" />
      </p>
      {visitorDriven ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          You&apos;re driving the budget. Restart to follow the script.
        </p>
      ) : null}
    </div>
  );
}

function EffortScaleMark({
  current,
  level,
}: {
  current: ContextEffortLevel;
  level: ContextEffortLevel;
}) {
  const active = current === level;
  const budget = CONTEXT_EFFORT_BUDGETS[level];

  return (
    <span className={active ? "text-foreground" : undefined}>
      {budget.name} {formatTokenCount(budget.combinedTokenCap)}
    </span>
  );
}

function MemoryList({ memories, className }: { memories: readonly string[]; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 p-3 shadow-sm sm:p-4",
        glass({ border: "none" }),
        className
      )}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Memories in context
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {SHOWCASE_STORY.premise} Synthetic for this demo —{" "}
        <span className="font-mono text-foreground">{memories.length}</span> of{" "}
        {SHOWCASE_STORY.memories.length} are in the window.
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {memories.map((memory) => (
          <li key={memory} className="text-xs leading-relaxed text-foreground/90">
            {memory}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Local composer state so the production slider can render. Effort changes stay in React
 * state — no settings write, storage, or fetch.
 */
function EffortSliderBridge({
  effort,
  onContextEffortChange,
}: {
  effort: ContextEffortLevel;
  onContextEffortChange: (level: ContextEffortLevel) => void;
}) {
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useMemories, setUseMemories] = useState(true);
  const [useSpeechFriendly, setUseSpeechFriendly] = useState(false);
  const [inputMarkdownMode, setInputMarkdownMode] = useState<"edit" | "preview">("edit");
  const [model, setModel] = useState(DEMO_MODEL);
  const [chatEffort, setChatEffort] = useState<ChatEffortLevel>("auto");

  const value = useMemo<CoreInputControlsValue>(
    () => ({
      showLabels: true,
      useCondensedLayout: false,
      useWebSearch,
      setUseWebSearch,
      useMemories,
      setUseMemories,
      useSpeechFriendly,
      setUseSpeechFriendly,
      inputMarkdownMode,
      setInputMarkdownMode,
      model,
      selectableModels: SELECTABLE_MODELS,
      onModelChange: (id: string) => {
        const next = SELECTABLE_MODELS.find((candidate) => candidate.id === id);

        if (next) setModel(next);
      },
      effort: chatEffort,
      onEffortChange: (id: string) => {
        setChatEffort(id as ChatEffortLevel);
      },
      showContextEffort: true,
      contextEffort: effort,
      onContextEffortChange,
    }),
    [
      chatEffort,
      effort,
      inputMarkdownMode,
      model,
      onContextEffortChange,
      useMemories,
      useSpeechFriendly,
      useWebSearch,
    ]
  );

  return (
    <CoreInputControlsProvider value={value}>
      <ComposerContextEffortSlider />
    </CoreInputControlsProvider>
  );
}
