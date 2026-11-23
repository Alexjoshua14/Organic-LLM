"use client";

import type { AgentDotState } from "@/components/agents/agent-dot-grid-motion";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ListTree } from "lucide-react";
import { Dialog } from "radix-ui";

import { JevStageMessage } from "./jev-stage-message";
import { JevStageStatus } from "./jev-stage-status";

import { AGENT_DOT_COMPLETION_MS } from "@/components/agents/agent-dot-grid-motion";
import { JevStageInsightPanel } from "@/components/jev-stage/insight-panel";
import { useJevStage } from "@/components/jev-stage/use-jev-stage";
import { StageView } from "@/components/stage/stage";
import { useIsMobile } from "@/hooks/use-mobile";
import { triggerInsetX } from "@/lib/layout/nav-chrome";
import { cn } from "@/lib/utils";

export function JevStageLab() {
  const stage = useJevStage();
  const isMobile = useIsMobile();
  const [insightOpen, setInsightOpen] = useState(false);
  const [conversationRail, setConversationRail] = useState<HTMLDivElement | null>(null);
  const activeDesign = stage.state?.design;
  const designStatus = stage.designerStatus ?? activeDesign?.error;
  const working = stage.working;
  const latestTurn = stage.insights.at(-1);
  const outcome = latestTurn?.outcome;
  const completedTurnId = outcome === "ok" ? latestTurn?.turnId : undefined;
  const [settledTurnId, setSettledTurnId] = useState<string>();
  const agentState: AgentDotState =
    working || stage.sending || stage.designerStatus
      ? "working"
      : stage.error || activeDesign?.status === "failed" || (outcome && outcome !== "ok")
        ? "blocked"
        : completedTurnId && settledTurnId !== completedTurnId
          ? "complete"
          : "idle";

  useEffect(() => {
    if (agentState !== "complete" || !completedTurnId) return;
    const timer = window.setTimeout(() => setSettledTurnId(completedTurnId), AGENT_DOT_COMPLETION_MS);

    return () => window.clearTimeout(timer);
  }, [agentState, completedTurnId]);

  return (
    <Dialog.Root open={isMobile && insightOpen} onOpenChange={setInsightOpen}>
      <div className="relative flex min-h-0 flex-1">
        <div className="jev-stage relative flex min-h-0 min-w-0 flex-1 flex-col">
          <nav
            aria-label="Jev Stage prototype"
            className={cn(
              "absolute inset-x-0 top-0 z-10 flex h-16 items-center gap-3 text-sm",
              triggerInsetX,
              "pr-40"
            )}
          >
            <Link
              aria-label="Back to prototypes"
              className="organic-focus flex min-h-11 shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              <ArrowLeft aria-hidden className="size-4" />
              <span className="hidden sm:inline">Prototypes</span>
            </Link>
            <span className="hidden truncate text-2xs uppercase tracking-widest text-muted-foreground/80 md:block">
              Jev Stage · prototype
            </span>
            {stage.streamingText ? (
              <span
                aria-live="polite"
                className="sr-only md:not-sr-only md:min-w-0 md:flex-1 md:truncate md:text-2xs md:text-muted-foreground"
                title={stage.streamingText}
              >
                {stage.streamingText}
              </span>
            ) : null}
          </nav>
          <StageView
            scripted
            defaultWebSearch
            stackPiecesOnMobile
            stage={stage}
            agentState={agentState}
            conversationRail={conversationRail}
            composerPlaceholder="Ask Organic…"
            extraTools={
              <div className="md:hidden">
                <Dialog.Trigger
                  className="stage-tool w-11 justify-center"
                  aria-label="Insight"
                  type="button"
                >
                  <ListTree aria-hidden size={15} />
                </Dialog.Trigger>
              </div>
            }
            agentMessage={
              stage.submittedMessage ? (
                <JevStageMessage
                  key={stage.submittedMessage.id}
                  text={stage.submittedMessage.text}
                />
              ) : null
            }
            renderAgentStatus={(status) => (
              <JevStageStatus
                className={
                  stage.submittedMessage || stage.designerStatus
                    ? cn(
                        "w-full shrink-0 break-words text-xs font-medium",
                        stage.submittedMessage ? "mt-1" : "mt-2",
                        stage.submittedMessage && !working ? "text-destructive" : "text-foreground"
                      )
                    : "stage-agent-status"
                }
                pulse={stage.statusPulse}
                text={stage.submittedMessage
                  ? stage.turnStatus
                  : (stage.correctionStatus ?? stage.designerStatus ?? (working ? "Working on earlier requests" : status))}
                working={stage.submittedMessage ? working : !!stage.designerStatus}
              />
            )}
          />
          <div className="pointer-events-none absolute inset-x-4 bottom-28 top-28 z-20">
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
                        working
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
        <div
          ref={setConversationRail}
          className="absolute inset-x-4 bottom-28 top-20 z-30 overflow-hidden rounded-xl border border-border bg-background empty:hidden md:relative md:inset-auto md:z-auto md:w-64 md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0 xl:w-80"
        />
      </div>
    </Dialog.Root>
  );
}
