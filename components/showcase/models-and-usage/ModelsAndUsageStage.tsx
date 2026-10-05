"use client";

import type { CoreInputControlsValue } from "@/components/chat/core-input/core-input-context";
import type { ModelsUsageDerivedFrame } from "@/lib/showcase/models-and-usage/script";
import type { UsageRangePreset } from "@/lib/usage/aggregate";

import { useCallback, useRef, useState } from "react";

import { UsageShowcasePanel } from "./UsageShowcasePanel";

import { CoreInputControlsProvider } from "@/components/chat/core-input/core-input-context";
import { ComposerModelSelect } from "@/components/chat/core-input/controls/model-select";
import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useShowcaseReplay } from "@/components/showcase/replay/use-showcase-replay";
import {
  SHOWCASE_USAGE_BY_PERIOD,
  SHOWCASE_USAGE_DEFAULT_PERIOD,
} from "@/lib/showcase/models-and-usage/payloads";
import {
  MODELS_USAGE_PROMPT,
  deriveModelsUsageFrame,
  modelsUsageScript,
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
    durationMs: modelsUsageScript.durationMs,
    chapterStarts: scriptChapterStarts(modelsUsageScript),
    chapterSettledTimes: scriptChapterSettledTimes(modelsUsageScript),
    stageRef,
    loop: false,
    autoplay: false,
    initialTimeMs: modelsUsageScript.durationMs,
  });
  const frame = deriveModelsUsageFrame(modelsUsageScript, replay.tMs);
  const chapter = modelsUsageScript.chapters[frame.chapterIndex]!;

  return (
    <div ref={stageRef} className="flex min-w-0 flex-col gap-4">
      <ReplayControls
        caption={chapter.caption}
        chapterIndex={frame.chapterIndex}
        chapters={modelsUsageScript.chapters}
        playing={replay.playing}
        progress={replay.progress}
        reduceMotion={replay.reduceMotion}
        onPause={replay.pause}
        onPlay={replay.play}
        onRestart={replay.restart}
        onSeekChapter={replay.seekChapter}
      />
      {/* Remounting clears a visitor's model and period so restart replays the script. */}
      <ModelsUsageScene key={replay.resetKey} frame={frame} onTakeover={replay.takeover} />
    </div>
  );
}

function ModelsUsageScene({
  frame,
  onTakeover,
}: {
  frame: ModelsUsageDerivedFrame;
  onTakeover: () => void;
}) {
  const modelOverrideRef = useRef<string | null>(null);
  const periodRef = useRef<UsageRangePreset>(SHOWCASE_USAGE_DEFAULT_PERIOD);
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const [period, setPeriod] = useState<UsageRangePreset>(SHOWCASE_USAGE_DEFAULT_PERIOD);
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

  const handlePeriodChange = useCallback(
    (next: UsageRangePreset) => {
      if (periodRef.current === next) return;

      periodRef.current = next;
      onTakeover();
      setPeriod(next);
    },
    [onTakeover]
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
        <p className="sr-only">Sample prompt for the Milky Way shoot. Nothing is submitted.</p>
        <p className="px-1 pb-3 text-sm leading-relaxed text-foreground/90">
          {MODELS_USAGE_PROMPT}
        </p>
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

      {frame.showUsage ? (
        <div className="min-w-0">
          <UsageShowcasePanel
            payload={SHOWCASE_USAGE_BY_PERIOD[period]}
            period={period}
            onPeriodChange={handlePeriodChange}
          />
        </div>
      ) : null}
    </div>
  );
}
