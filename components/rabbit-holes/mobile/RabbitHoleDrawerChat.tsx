"use client";

import type { UIMessage } from "ai";
import type { useChat } from "@ai-sdk/react";
import type { RabbitHoleNode, RabbitHoleSession, RabbitHoleSource } from "@/lib/schemas/rabbitHoleSchemas";

import { useEffect, useMemo, useRef, useState } from "react";

import { MobileSourcePills } from "./MobileSourcePills";
import { RabbitHoleDrawerBranchGrid } from "./RabbitHoleDrawerBranchGrid";
import { RabbitHoleDrawerTurnPair } from "./RabbitHoleDrawerTurnPair";
import { RabbitHoleNodeCreationApproval } from "@/components/rabbit-holes/RabbitHoleNodeCreationApproval";

import { clampTurnIndex, deriveDrawerChatTurns } from "@/lib/rabbit-holes/drawer-turns";
import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";

export type RabbitHoleDrawerChatProps = {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  messages: UIMessage[];
  chatId: string;
  isStreaming?: boolean;
  aiAction?: { action: ChatAIActionEnum; message?: string };
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

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
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
