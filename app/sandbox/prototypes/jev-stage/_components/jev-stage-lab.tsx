"use client";

import { useState } from "react";
import Link from "next/link";

import { JevStageMessage } from "./jev-stage-message";

import { ChatThinking } from "@/components/chat/chat-loading";
import { JevStageInsightPanel } from "@/components/jev-stage/insight-panel";
import { useJevStage } from "@/components/jev-stage/use-jev-stage";
import { StageView } from "@/components/stage/stage";
import { triggerInsetX } from "@/lib/layout/nav-chrome";
import { cn } from "@/lib/utils";

export function JevStageLab() {
  const stage = useJevStage();
  const [conversationRail, setConversationRail] = useState<HTMLDivElement | null>(null);
  const activeDesign = stage.state?.design;
  const designStatus = stage.designerStatus ?? activeDesign?.error;

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={setConversationRail}
        className="absolute inset-x-4 bottom-28 top-20 z-30 overflow-hidden rounded-xl border border-border bg-background empty:hidden md:relative md:inset-auto md:z-auto md:w-64 md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0 xl:w-80"
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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
          defaultWebSearch
          stage={stage}
          conversationRail={conversationRail}
          agentMessage={
            stage.submittedMessage ? (
              <JevStageMessage
                key={stage.submittedMessage.id}
                text={stage.submittedMessage.text}
                status={stage.turnStatus}
                working={stage.sending || stage.recovering}
              />
            ) : stage.designerStatus ? (
              <div
                className="mt-2 w-full overflow-hidden text-xs font-medium text-foreground"
                title={stage.designerStatus}
              >
                <ChatThinking text={stage.designerStatus} />
              </div>
            ) : null
          }
        />
        <div className="pointer-events-none absolute inset-x-4 bottom-28 top-20 z-20">
          <JevStageInsightPanel
            insights={stage.insights}
            design={
              activeDesign && designStatus
                ? { turnId: activeDesign.id, status: designStatus }
                : undefined
            }
            live={
              stage.submittedMessage &&
              !stage.insights.some((insight) => insight.turnId === stage.submittedMessage?.id)
                ? {
                    text: stage.submittedMessage.text,
                    status:
                      stage.sending || stage.recovering
                        ? stage.turnStatus
                        : (stage.error ?? stage.turnStatus),
                    events: stage.liveTrace,
                  }
                : undefined
            }
            onEval={stage.setEval}
          />
        </div>
      </div>
    </div>
  );
}
