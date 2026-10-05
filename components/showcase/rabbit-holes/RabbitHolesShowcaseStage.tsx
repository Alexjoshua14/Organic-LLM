"use client";

import type { RabbitHoleDemoState } from "@/lib/showcase/rabbit-holes";

import { useRef, useState } from "react";

import { RabbitHoleBranchSuggestionsBlock } from "@/app/rabbitholes/_components/RabbitHoleBranchSuggestionsBlock";
import { RabbitHolePathRail } from "@/app/rabbitholes/_components/RabbitHolePathRail";
import { RabbitHoleDemoArticle } from "@/components/showcase/rabbit-holes/RabbitHoleDemoArticle";
import { ReplayControls } from "@/components/showcase/replay/ReplayControls";
import { useShowcaseReplay } from "@/components/showcase/replay/use-showcase-replay";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  branchNodeIdFor,
  deriveRabbitHoleDemoState,
  rabbitHoleDemoSessionFor,
  rabbitHolesCompiledScript,
} from "@/lib/showcase/rabbit-holes";
import {
  deriveScriptFrame,
  scriptChapterSettledTimes,
  scriptChapterStarts,
} from "@/lib/showcase/scripted-timeline";
import { cn } from "@/lib/utils";

const script = rabbitHolesCompiledScript;

export function RabbitHolesShowcaseStage() {
  const stageRef = useRef<HTMLElement>(null);
  const replay = useShowcaseReplay({
    durationMs: script.durationMs,
    chapterStarts: scriptChapterStarts(script),
    chapterSettledTimes: scriptChapterSettledTimes(script),
    stageRef,
    loop: false,
    autoplay: false,
    initialTimeMs: script.durationMs,
  });
  const frame = deriveScriptFrame(script, replay.tMs);
  const scripted = deriveRabbitHoleDemoState(replay.tMs);
  const chapter = script.chapters[frame.chapterIndex]!;

  return (
    <section
      ref={stageRef}
      aria-label="Rabbit Holes replay"
      className="flex min-w-0 flex-col gap-4"
    >
      <ReplayControls
        caption={chapter.caption}
        chapterIndex={frame.chapterIndex}
        chapters={script.chapters.map((item) => ({ id: item.id, title: item.title }))}
        playing={replay.playing}
        bar={replay.bar}
        progress={replay.progress}
        reduceMotion={replay.reduceMotion}
        onPause={replay.pause}
        onPlay={replay.play}
        onRestart={replay.restart}
        onSeekChapter={replay.seekChapter}
      />
      <RabbitHolesDemoPanels
        key={replay.resetKey}
        scripted={scripted}
        onTakeover={replay.takeover}
      />
    </section>
  );
}

function RabbitHolesDemoPanels({
  scripted,
  onTakeover,
}: {
  scripted: RabbitHoleDemoState;
  onTakeover: () => void;
}) {
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const activeNodeId = overrideId ?? scripted.activeNodeId;
  const session = rabbitHoleDemoSessionFor(scripted, activeNodeId);
  const node = session.nodesById[activeNodeId];
  const inspecting = overrideId !== null;
  const showSummary = inspecting || scripted.showSummary;
  const showBranches = inspecting || scripted.showBranchSuggestions;
  const branches = node?.branchSuggestions ?? [];

  const chooseNode = (nodeId: string) => {
    onTakeover();
    setOverrideId(nodeId === scripted.activeNodeId ? null : nodeId);
  };

  const chooseBranch = (branchId: string) => {
    const nodeId = branchNodeIdFor(branchId);

    if (!nodeId) return;
    chooseNode(nodeId);
  };

  if (!node) return null;

  const pathLabel = session.path.map((segment) => segment.label).join(" → ");

  return (
    <div className={cn("showcase-research-grid grid min-w-0 grid-cols-1 items-start gap-5")}>
      <div className="showcase-research-path min-w-0 [&_button]:min-h-11">
        <RabbitHolePathRail
          activeNodeId={session.activeNodeId}
          session={session}
          onNodeClick={chooseNode}
        />
      </div>
      <div className="showcase-research-article min-w-0">
        <RabbitHoleDemoArticle
          inspecting={inspecting}
          node={node}
          pathLabel={pathLabel}
          showSummary={showSummary}
        />
      </div>
      <aside className="showcase-research-branches min-w-0">
        {showBranches && branches.length > 0 ? (
          <div className="[&_button]:min-h-11">
            <RabbitHoleBranchSuggestionsBlock
              branches={branches}
              hasSources={false}
              isLoading={false}
              onBranchClick={chooseBranch}
            />
          </div>
        ) : (
          <div className={cn(card, "p-4 sm:p-5")}>
            <h2 className={sectionLabel}>Explore Further</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Related questions appear here with the summary.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
