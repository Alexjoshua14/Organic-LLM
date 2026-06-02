"use client";

import type {
  ContextLoadStage,
  InputIntentStage,
  MemorySearchStage,
  RenderStage,
  ShowcaseStage,
  TokenBudgetStage,
  ToolRoutingStage,
  TtsStage,
} from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";

import { AnatomyContextStage } from "@/components/showcase/anatomy/AnatomyContextStage";
import { AnatomyInputStage } from "@/components/showcase/anatomy/AnatomyInputStage";
import { AnatomyMemoryStage } from "@/components/showcase/anatomy/AnatomyMemoryStage";
import { AnatomyRenderStage } from "@/components/showcase/anatomy/AnatomyRenderStage";
import { AnatomyStreamingStage } from "@/components/showcase/anatomy/AnatomyStreamingStage";
import { AnatomyToolRoutingStage } from "@/components/showcase/anatomy/AnatomyToolRoutingStage";
import { AnatomyTtsStage } from "@/components/showcase/anatomy/AnatomyTtsStage";
import { useAnatomyMotion } from "@/components/showcase/anatomy/anatomy-motion";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type StagePanelProps = {
  stage: ShowcaseStage;
  index: number;
  sectionRef: (el: HTMLElement | null) => void;
};

function StageArtifact({ stage }: { stage: ShowcaseStage }) {
  switch (stage.id) {
    case "input":
      return <AnatomyInputStage stage={stage as InputIntentStage} />;
    case "context":
      return <AnatomyContextStage stage={stage as ContextLoadStage} />;
    case "memory":
      return <AnatomyMemoryStage stage={stage as MemorySearchStage} />;
    case "tools":
      return <AnatomyToolRoutingStage stage={stage as ToolRoutingStage} />;
    case "budget":
      return <AnatomyStreamingStage stage={stage as TokenBudgetStage} />;
    case "render":
      return <AnatomyRenderStage stage={stage as RenderStage} />;
    case "tts":
      return <AnatomyTtsStage stage={stage as TtsStage} />;
    default:
      return null;
  }
}

export function StagePanel({ stage, index, sectionRef }: StagePanelProps) {
  const { sectionReveal, reduce } = useAnatomyMotion();

  return (
    <motion.section
      ref={sectionRef}
      aria-labelledby={`showcase-stage-${index}-title`}
      className={cn(
        "scroll-mt-28 rounded-2xl border border-border/60 p-5 shadow-sm",
        glass({ border: "none" }),
        !reduce && "motion-safe:will-change-transform"
      )}
      data-stage-index={index}
      {...(sectionReveal ?? {})}
    >
      <div className="mb-1">
        <span className="text-xs font-mono text-muted-foreground">Stage {index + 1}</span>
      </div>
      <h2
        className="mb-2 font-commissioner text-lg font-light text-foreground"
        id={`showcase-stage-${index}-title`}
      >
        {stage.title}
      </h2>
      <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {stage.annotation}
      </p>

      <StageArtifact stage={stage} />
    </motion.section>
  );
}
