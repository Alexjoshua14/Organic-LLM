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
import { cn } from "@/lib/utils";

type StagePanelProps = {
  stage: ShowcaseStage;
  index: number;
  sectionRef: (el: HTMLElement | null) => void;
};

function JsonRaw({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border/50 bg-background/60 p-3 text-[11px] leading-relaxed text-foreground/90">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

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
      return <JsonRaw value={(stage as ShowcaseStage).artifact} />;
  }
}

export function StagePanel({ stage, index, sectionRef }: StagePanelProps) {
  const { sectionReveal, reduce } = useAnatomyMotion();

  return (
    <motion.section
      ref={sectionRef}
      aria-labelledby={`showcase-stage-${index}-title`}
      className={cn(
        "scroll-mt-28 rounded-2xl border border-border/60 bg-background/30 p-5 shadow-sm backdrop-blur-sm",
        !reduce && "motion-safe:will-change-transform"
      )}
      data-stage-index={index}
      {...(sectionReveal ?? {})}
    >
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-mono text-muted-foreground">Stage {index + 1}</span>
        {stage.timingMs != null ? (
          <span className="text-xs text-muted-foreground">{stage.timingMs} ms</span>
        ) : null}
      </div>
      <h2
        className="mb-2 font-commissioner text-lg font-light text-foreground"
        id={`showcase-stage-${index}-title`}
      >
        {stage.title}
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{stage.annotation}</p>

      <StageArtifact stage={stage} />

      <details className="mt-5 border-t border-border/40 pt-4">
        <summary className="cursor-pointer select-none text-xs font-medium text-foreground/80 hover:text-foreground">
          Developer: raw JSON
        </summary>
        <JsonRaw value={stage} />
      </details>
    </motion.section>
  );
}
