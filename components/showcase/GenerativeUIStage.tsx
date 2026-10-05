"use client";

import type { ShoppingListBlock } from "@/lib/schemas/gen-ui";

import { useMemo, useRef, useState } from "react";
import { Check, ListChecks, Table2, Route } from "lucide-react";

import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useShowcaseReplay } from "@/components/showcase/replay/use-showcase-replay";
import { DecisionMatrix } from "@/components/chat/gen-ui/blocks/DecisionMatrix";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import { ShoppingList } from "@/components/chat/gen-ui/blocks/ShoppingList";
import { showcaseDecision, showcaseKit, showcasePlan } from "@/lib/showcase/generative-ui";
import {
  GEN_UI_SCRIPT,
  deriveGenUiDemo,
  genUiCompiledScript,
  type GenUiViewId,
} from "@/lib/showcase/generative-ui-script";
import { scriptChapterSettledTimes, scriptChapterStarts } from "@/lib/showcase/scripted-timeline";

const SKELETON_TYPE = {
  compare: "decision-matrix",
  plan: "plan-timeline",
  kit: "shopping-list",
} as const;

const VIEWS = [
  {
    id: "compare",
    title: "Compare places",
    Icon: Table2,
    prompt: "Find a dark-sky spot for my first Milky Way shoot. Keep the drive under four hours.",
    reply: "Pinnacles fits your trip. Here’s how the options compare.",
    hint: "Hover or focus a score to inspect the reasoning. Scores are illustrative.",
  },
  {
    id: "plan",
    title: "Make a plan",
    Icon: Route,
    prompt: "Turn that into a plan for my first night. Remember, I’m new to this.",
    reply: "Let’s take it one step at a time. Your 24mm lens is a good starting point.",
    hint: "Open a step to see the details behind the plan.",
  },
  {
    id: "kit",
    title: "Pack the kit",
    Icon: ListChecks,
    prompt: "What should I bring? Add an extra warm layer. I always get cold.",
    reply:
      "Your camera kit, the essentials, and something for the cold. Check things off as you pack.",
    hint: "Check off an item.",
  },
] as const;

const script = genUiCompiledScript;

export function GenerativeUIStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const replay = useShowcaseReplay({
    durationMs: script.durationMs,
    chapterStarts: scriptChapterStarts(script),
    chapterSettledTimes: scriptChapterSettledTimes(script),
    stageRef,
    loop: false,
    autoplay: false,
    // Open on the finished comparison; Play continues into the plan and the kit.
    initialTimeMs: scriptChapterSettledTimes(script)[0],
  });
  const frame = useMemo(() => deriveGenUiDemo(replay.tMs), [replay.tMs]);
  const chapter = GEN_UI_SCRIPT.chapters[frame.chapterIndex]!;

  return (
    <div ref={stageRef} className="flex flex-col gap-4">
      <ReplayControls
        caption={chapter.caption}
        chapterIndex={frame.chapterIndex}
        chapters={GEN_UI_SCRIPT.chapters}
        playing={replay.playing}
        bar={replay.bar}
        progress={replay.progress}
        reduceMotion={replay.reduceMotion}
        onPause={replay.pause}
        onPlay={replay.play}
        onRestart={replay.restart}
        onSeekChapter={replay.seekChapter}
      />
      <GenerativeUIPanels key={replay.resetKey} frame={frame} onTakeover={replay.takeover} />
    </div>
  );
}

function GenerativeUIPanels({
  frame,
  onTakeover,
}: {
  frame: ReturnType<typeof deriveGenUiDemo>;
  onTakeover: () => void;
}) {
  const [override, setOverride] = useState<GenUiViewId | null>(null);
  const [kit, setKit] = useState<ShoppingListBlock>(() => structuredClone(showcaseKit));
  const view: GenUiViewId = override ?? frame.view;
  const inspecting = override !== null;
  const current = VIEWS.find((item) => item.id === view)!;
  const promptText = inspecting
    ? current.prompt
    : current.prompt.slice(0, Math.ceil(current.prompt.length * frame.askProgress));
  const showReply = inspecting || frame.showReply;
  const block = inspecting ? "ready" : frame.block;

  const chooseView = (id: GenUiViewId) => {
    onTakeover();
    setOverride(id);
  };

  return (
    <div className="showcase-gen-stage">
      <div aria-label="Answer format" className="showcase-format-switch" role="group">
        {VIEWS.map(({ id, title, Icon }) => (
          <button key={id} aria-pressed={id === view} type="button" onClick={() => chooseView(id)}>
            <Icon aria-hidden size={16} />
            <span>{title}</span>
          </button>
        ))}
      </div>
      <div className="showcase-conversation" key={view}>
        <p className="showcase-user-prompt">{promptText}</p>
        {showReply ? (
          <div className="showcase-answer">
            <p className="showcase-assistant-name">
              <span aria-hidden className="showcase-organic-mark">
                <Check size={13} />
              </span>{" "}
              Organic
            </p>
            <p className="showcase-answer-copy">{current.reply}</p>
            {block !== "hidden" ? (
              <div className="showcase-answer-block">
                {block === "building" ? <GenUISkeleton type={SKELETON_TYPE[view]} /> : null}
                {block === "ready" && view === "compare" ? (
                  <DecisionMatrix block={showcaseDecision} />
                ) : null}
                {block === "ready" && view === "plan" ? (
                  <PlanTimeline block={showcasePlan} />
                ) : null}
                {block === "ready" && view === "kit" ? (
                  <ShoppingList
                    block={kit}
                    onToggleChecked={({ groupIndex, itemIndex }) => {
                      onTakeover();
                      setOverride(view);
                      setKit((previous) => ({
                        ...previous,
                        groups: previous.groups.map((group, gi) =>
                          gi === groupIndex
                            ? {
                                ...group,
                                items: group.items.map((item, ii) =>
                                  ii === itemIndex ? { ...item, checked: !item.checked } : item
                                ),
                              }
                            : group
                        ),
                      }));
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="showcase-stage-footnote">
        <p>{current.hint}</p>
      </div>
    </div>
  );
}
