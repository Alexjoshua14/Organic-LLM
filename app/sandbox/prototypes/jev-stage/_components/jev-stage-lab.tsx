"use client";

import Link from "next/link";

import { JevStageMessage } from "./jev-stage-message";

import { JevStageInsightPanel } from "@/components/jev-stage/insight-panel";
import { useJevStage } from "@/components/jev-stage/use-jev-stage";
import { StageView } from "@/components/stage/stage";
import { triggerInsetX } from "@/lib/layout/nav-chrome";
import { cn } from "@/lib/utils";

export function JevStageLab() {
  const stage = useJevStage();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <nav
        aria-label="Jev Stage prototype"
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex h-16 items-center gap-3 text-sm",
          triggerInsetX,
          "pr-24 md:pr-40"
        )}
      >
        <Link
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          href="/sandbox/prototypes"
        >
          &larr; Prototypes
        </Link>
        <span className="text-2xs uppercase tracking-widest text-muted-foreground/80">
          Jev Stage · prototype
        </span>
        {stage.streamingText ? (
          <span
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-2xs text-muted-foreground"
            title={stage.streamingText}
          >
            {stage.streamingText}
          </span>
        ) : null}
      </nav>
      <StageView
        scripted
        stage={stage}
        agentMessage={
          stage.submittedMessage && (
            <JevStageMessage
              key={stage.submittedMessage.id}
              text={stage.submittedMessage.text}
              status={stage.turnStatus}
              working={stage.sending}
            />
          )
        }
      />
      <div className="pointer-events-none absolute bottom-28 right-4 top-20 z-20">
        <div className="pointer-events-auto sticky top-20 flex justify-end">
          <JevStageInsightPanel insights={stage.insights} onEval={stage.setEval} />
        </div>
      </div>
    </div>
  );
}
