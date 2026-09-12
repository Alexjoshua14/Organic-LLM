"use client";

import type { CenterViewState } from "@/lib/rabbit-holes/centerViewState";
import type {
  RabbitHoleNode,
  RabbitHoleSession,
  RabbitHoleSource,
} from "@/lib/schemas/rabbitHoleSchemas";
import type { MobileSheetSnap } from "./MobileBottomSheet";

import { useRef } from "react";

import { RabbitHoleDrawerChat } from "./RabbitHoleDrawerChat";
import { RabbitHolePromptBar } from "@/components/rabbit-holes/RabbitHolePromptBar";
import { useRabbitHoleChatComposer } from "@/hooks/use-rabbit-hole-chat-composer";
import { useRabbitHoleDrawerDisplay } from "@/hooks/use-rabbit-hole-drawer-display";
import type { SimpleResult } from "@/types";

export type UseRabbitHoleMobileDrawerParams = {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  centerViewState: CenterViewState;
  sheetSnap: MobileSheetSnap;
  isBusy: boolean;
  canGoBack: boolean;
  onNavigateBack: () => void;
  onBranchClick: (branchId: string) => void;
  onSourceClick: (source: RabbitHoleSource) => void;
  onReset: () => void;
  onNavFromTool: (activeNodeId: string) => void;
  ensureEmptySession: () => Promise<SimpleResult & { sessionId?: string }>;
  onSessionCreated?: (sessionId: string) => void;
};

export function useRabbitHoleMobileDrawer({
  session,
  activeNode,
  centerViewState,
  sheetSnap,
  isBusy,
  canGoBack,
  onNavigateBack,
  onBranchClick,
  onSourceClick,
  onReset,
  onNavFromTool,
  ensureEmptySession,
  onSessionCreated,
}: UseRabbitHoleMobileDrawerParams) {
  const aiBlockRef = useRef<HTMLDivElement>(null);
  const { displayInputRef } = useRabbitHoleDrawerDisplay(aiBlockRef, sheetSnap);

  const chat = useRabbitHoleChatComposer({
    sessionId: session?.sessionId ?? null,
    drawerDisplayRef: displayInputRef,
    onNavigate: onNavFromTool,
    ensureEmptySession,
    onSessionCreated,
  });

  const sources = activeNode?.sources ?? [];
  const branches =
    session?.generatingNodeId === activeNode?.id ? [] : (activeNode?.branchSuggestions ?? []);

  const composer = (
    <RabbitHolePromptBar
      disabled={chat.bootstrapping}
      isBusy={isBusy || chat.isStreaming}
      isLoading={isBusy || chat.isStreaming}
      sendMessage={chat.sendChatMessage}
      status={chat.status}
      stop={chat.stop}
      onReset={onReset}
    />
  );

  const body =
    centerViewState.kind === "loading_source_analysis" ? (
      <p className="text-center text-xs text-muted-foreground">Analyzing source…</p>
    ) : (
      <RabbitHoleDrawerChat
        activeNode={activeNode}
        addToolApprovalResponse={chat.addToolOutput}
        aiAction={chat.aiAction}
        aiBlockRef={aiBlockRef}
        branches={session ? branches : []}
        canGoBack={canGoBack}
        chatId={chat.threadId ?? chat.id}
        isBusy={isBusy}
        isStreaming={chat.isStreaming}
        messages={chat.messages}
        session={session}
        sources={session ? sources : []}
        onBranchClick={onBranchClick}
        onNavigateBack={onNavigateBack}
        onSourceClick={onSourceClick}
      />
    );

  return { composer, body, sendChatText: chat.sendChatText };
}
