"use client";

import type { UIMessage } from "ai";
import type { useChat } from "@ai-sdk/react";
import type {
  RabbitHoleNode,
  RabbitHoleSession,
  RabbitHoleSource,
} from "@/lib/schemas/rabbitHoleSchemas";
import type {
  RabbitHolePlanBudgetSummary,
  RabbitHoleSubagentMeshItem,
} from "@/components/rabbit-holes/RabbitHoleSubagentMeshBar";
import type { LlmProcessingIntensitySnapshot } from "@/lib/usage/processing-intensity";

import { useEffect, useMemo, useRef, useState } from "react";

import { MobileSourcePills } from "./MobileSourcePills";
import { RabbitHoleDrawerBranchGrid } from "./RabbitHoleDrawerBranchGrid";
import { RabbitHoleDrawerTurnPair } from "./RabbitHoleDrawerTurnPair";

import { RabbitHoleNodeCreationApproval } from "@/components/rabbit-holes/RabbitHoleNodeCreationApproval";
import { RabbitHoleSubagentMeshBar } from "@/components/rabbit-holes/RabbitHoleSubagentMeshBar";
import { clampTurnIndex, deriveDrawerChatTurns } from "@/lib/rabbit-holes/drawer-turns";
import {
  computeLlmProcessingIntensity,
  deriveSessionTelemetryCounts,
} from "@/lib/usage/processing-intensity";
import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";

export type RabbitHoleDrawerChatProps = {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  messages: UIMessage[];
  chatId: string;
  isStreaming?: boolean;
  aiAction?: { action: ChatAIActionEnum; message?: string };
  subagents?: readonly RabbitHoleSubagentMeshItem[];
  processingIntensity?: LlmProcessingIntensitySnapshot;
  planBudget?: RabbitHolePlanBudgetSummary | null;
  zeroDataRetention?: boolean;
  sources: RabbitHoleSource[];
  branches: NonNullable<RabbitHoleNode["branchSuggestions"]>;
  isBusy: boolean;
  canGoBack: boolean;
  onNavigateBack: () => void;
  onBranchClick: (branchId: string) => void;
  onSourceClick: (source: RabbitHoleSource) => void;
  aiBlockRef?: React.RefObject<HTMLDivElement | null>;
  addToolApprovalResponse?: ReturnType<typeof useChat>["addToolOutput"];
  aiScrollClassName?: string;
  className?: string;
};

export function RabbitHoleDrawerChat({
  session,
  activeNode,
  messages,
  chatId,
  isStreaming = false,
  aiAction,
  subagents = [],
  processingIntensity: processingIntensityProp,
  planBudget = null,
  zeroDataRetention = false,
  sources,
  branches,
  isBusy,
  canGoBack,
  onNavigateBack,
  onBranchClick,
  onSourceClick,
  aiBlockRef: aiBlockRefProp,
  addToolApprovalResponse,
  aiScrollClassName,
  className,
}: RabbitHoleDrawerChatProps) {
  const internalAiRef = useRef<HTMLDivElement>(null);
  const aiBlockRef = aiBlockRefProp ?? internalAiRef;
  const turns = useMemo(() => deriveDrawerChatTurns(messages), [messages]);
  const [turnIndex, setTurnIndex] = useState(() => Math.max(0, turns.length - 1));
  const prevTurnCount = useRef(turns.length);

  useEffect(() => {
    if (turns.length > prevTurnCount.current) {
      setTurnIndex(turns.length - 1);
    } else {
      setTurnIndex((i) => clampTurnIndex(i, turns.length));
    }

    prevTurnCount.current = turns.length;
  }, [turns.length]);

  const currentTurn = turns[turnIndex] ?? null;

  const counts = useMemo(
    () => deriveSessionTelemetryCounts({ messages, subagents }),
    [messages, subagents]
  );

  const processingIntensity = useMemo(() => {
    if (processingIntensityProp) return processingIntensityProp;

    return computeLlmProcessingIntensity({
      isStreaming,
      activeSubagentCount: counts.activeSubagentCount,
      completedSubagentCount: counts.completedSubagentCount,
      toolCallCount: counts.toolCallCount,
      estimatedTokensUsed: counts.estimatedTokensUsed,
      planSpentUsd: planBudget?.spentUsd ?? planBudget?.usedUsd,
      planLimitUsd: planBudget?.limitUsd !== undefined ? planBudget.limitUsd : planBudget?.capUsd,
      zeroDataRetention,
    });
  }, [processingIntensityProp, counts, isStreaming, planBudget, zeroDataRetention]);

  const budgetUtilizationRatio = useMemo(() => {
    const spent = planBudget?.spentUsd ?? planBudget?.usedUsd;
    const limit =
      planBudget?.limitUsd !== undefined ? planBudget.limitUsd : (planBudget?.capUsd ?? null);

    if (
      typeof spent === "number" &&
      Number.isFinite(spent) &&
      typeof limit === "number" &&
      Number.isFinite(limit) &&
      limit > 0
    ) {
      return Math.max(0, Math.min(1, spent / limit));
    }

    return processingIntensity.budgetUtilizationRatio;
  }, [planBudget, processingIntensity.budgetUtilizationRatio]);

  const showMeshBar =
    subagents.length > 0 ||
    isStreaming ||
    isBusy ||
    processingIntensity.tier !== "idle" ||
    (messages.length > 0 && (counts.toolCallCount > 0 || zeroDataRetention)) ||
    (budgetUtilizationRatio !== null && budgetUtilizationRatio >= 0.75) ||
    planBudget?.canDispatch === false;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {showMeshBar ? (
        <RabbitHoleSubagentMeshBar
          planBudget={planBudget}
          processingIntensity={processingIntensity}
          subagents={subagents}
          zeroDataRetention={zeroDataRetention}
        />
      ) : null}

      <RabbitHoleDrawerTurnPair
        aiBlockRef={aiBlockRef}
        aiScrollClassName={aiScrollClassName}
        chatId={chatId}
        isStreaming={isStreaming && turnIndex === turns.length - 1 && !currentTurn?.assistant}
        aiActionMessage={aiAction?.message}
        turn={currentTurn}
        turnCount={turns.length}
        turnIndex={turnIndex}
        onTurnIndexChange={(i) => setTurnIndex(clampTurnIndex(i, turns.length))}
      />

      {addToolApprovalResponse ? (
        <RabbitHoleNodeCreationApproval
          addToolApprovalResponse={addToolApprovalResponse}
          messages={messages}
          session={session}
        />
      ) : null}

      {activeNode && sources.length > 0 ? (
        <MobileSourcePills sources={sources} onSourceClick={onSourceClick} />
      ) : null}

      {activeNode ? (
        <RabbitHoleDrawerBranchGrid
          activeNodeId={activeNode.id}
          branches={branches ?? []}
          canGoBack={canGoBack}
          isLoading={isBusy}
          session={session}
          onBranchClick={onBranchClick}
          onNavigateBack={onNavigateBack}
        />
      ) : null}
    </div>
  );
}
