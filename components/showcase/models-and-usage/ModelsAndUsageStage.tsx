"use client";

import type { CoreInputControlsValue } from "@/components/chat/core-input/core-input-context";
import type { ModelDerivedFrame } from "@/lib/showcase/models-and-usage/script";

import { useCallback, useRef, useState } from "react";

import { CoreInputControlsProvider } from "@/components/chat/core-input/core-input-context";
import { ComposerModelSelect } from "@/components/chat/core-input/controls/model-select";
import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useShowcaseReplay } from "@/components/showcase/replay/use-showcase-replay";
import {
  deriveModelFrame,
  modelFacts,
  modelSelectionScript,
  showcaseSelectableModels,
} from "@/lib/showcase/models-and-usage/script";
import { scriptChapterSettledTimes, scriptChapterStarts } from "@/lib/showcase/scripted-timeline";
import { DEFAULT_CONTEXT_EFFORT } from "@/lib/memory/context-effort";
import { DEFAULT_CHAT_EFFORT } from "@/lib/schemas/chat-effort";
import { cn } from "@/lib/utils";

/** Toggles the real composer mounts. This demo only renders the model menu. */
function noop() {}

export function ModelsAndUsageStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const replay = useShowcaseReplay({
    durationMs: modelSelectionScript.durationMs,
    chapterStarts: scriptChapterStarts(modelSelectionScript),
    chapterSettledTimes: scriptChapterSettledTimes(modelSelectionScript),
    stageRef,
    loop: false,
    autoplay: false,
    initialTimeMs: modelSelectionScript.durationMs,
  });
  const frame = deriveModelFrame(modelSelectionScript, replay.tMs);
  const chapter = modelSelectionScript.chapters[frame.chapterIndex]!;

  return (
    <div ref={stageRef} className="flex min-w-0 flex-col gap-4">
      <ReplayControls
        caption={chapter.caption}
        chapterIndex={frame.chapterIndex}
        chapters={modelSelectionScript.chapters}
        playing={replay.playing}
        bar={replay.bar}
        progress={replay.progress}
        reduceMotion={replay.reduceMotion}
        onPause={replay.pause}
        onPlay={replay.play}
        onRestart={replay.restart}
        onSeekChapter={replay.seekChapter}
      />
      {/* Remounting clears a visitor's model so restart replays the script. */}
      <ModelScene key={replay.resetKey} frame={frame} onTakeover={replay.takeover} />
    </div>
  );
}

function ModelScene({ frame, onTakeover }: { frame: ModelDerivedFrame; onTakeover: () => void }) {
  const modelOverrideRef = useRef<string | null>(null);
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const modelId = modelOverride ?? frame.modelId;
  const model =
    showcaseSelectableModels.find((candidate) => candidate.id === modelId) ??
    showcaseSelectableModels[0];

  const handleModelChange = useCallback(
    (id: string) => {
      const active = modelOverrideRef.current ?? frame.modelId;

      if (active === id) return;

      modelOverrideRef.current = id;
      onTakeover();
      setModelOverride(id);
    },
    [frame.modelId, onTakeover]
  );

  const selecting = frame.beatId === "select" && modelOverride === null;

  if (!model) {
    throw new Error("No selectable chat models for the showcase composer");
  }

  const controls: CoreInputControlsValue = {
    showLabels: true,
    useCondensedLayout: false,
    useWebSearch: false,
    setUseWebSearch: noop,
    useMemories: false,
    setUseMemories: noop,
    useSpeechFriendly: false,
    setUseSpeechFriendly: noop,
    inputMarkdownMode: "edit",
    setInputMarkdownMode: noop,
    model,
    selectableModels: showcaseSelectableModels,
    onModelChange: handleModelChange,
    effort: DEFAULT_CHAT_EFFORT,
    onEffortChange: noop,
    showContextEffort: false,
    contextEffort: DEFAULT_CONTEXT_EFFORT,
    onContextEffortChange: noop,
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        aria-label="Composer"
        className={cn(homeComposerGlassSurface, "min-w-0 p-3 sm:p-4")}
        data-showcase-model={model.id}
      >
        <p className="sr-only">Sample prompt. Nothing is submitted.</p>
        <p className="px-1 pb-3 text-sm leading-relaxed text-foreground/90">{frame.prompt}</p>
        <div className="flex items-center border-t border-border/40 pt-2">
          <CoreInputControlsProvider value={controls}>
            <div
              className={cn(
                "group/segments flex h-8 shrink-0 items-center rounded-md ring-1 ring-inset ring-border/50",
                "motion-safe:transition-[box-shadow] motion-safe:duration-200",
                selecting && "ring-amber-400/70"
              )}
              data-effort="hidden"
            >
              <ComposerModelSelect />
            </div>
          </CoreInputControlsProvider>
        </div>
      </section>

      <ModelCard facts={modelFacts(model)} name={model.name} />
    </div>
  );
}

function ModelCard({ name, facts }: { name: string; facts: ReturnType<typeof modelFacts> }) {
  return (
    <section
      aria-label="Selected model"
      aria-live="polite"
      className="rounded-2xl border border-border/60 p-4 sm:p-5"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Answering with
      </p>
      <p className="mt-1 text-2xl font-light tracking-tight text-foreground">{name}</p>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Made by</dt>
          <dd className="mt-0.5 text-foreground">{facts.provider}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Context window</dt>
          <dd className="mt-0.5 text-foreground">{facts.contextWindow} tokens</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Data retention</dt>
          <dd className="mt-0.5 text-foreground">
            {facts.zeroDataRetention ? "Zero data retention" : "Standard"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
