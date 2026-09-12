"use client";

import type {
  RabbitHoleNode,
  RabbitHoleSession,
  RabbitHoleSource,
} from "@/lib/schemas/rabbitHoleSchemas";

import { useRef } from "react";
import { MessageSquare, X } from "lucide-react";

import { RabbitHoleDrawerChat } from "@/components/rabbit-holes/mobile/RabbitHoleDrawerChat";
import { RabbitHolePromptBar } from "@/components/rabbit-holes/RabbitHolePromptBar";
import { useRabbitHoleChatComposer } from "@/hooks/use-rabbit-hole-chat-composer";
import { useRabbitHoleDrawerDisplay } from "@/hooks/use-rabbit-hole-drawer-display";
import type { SimpleResult } from "@/types";
import { cn } from "@/lib/utils";

export type RabbitHoleAssistantPanelProps = {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  isBusy: boolean;
  canGoBack: boolean;
  onNavigateBack: () => void;
  onBranchClick: (branchId: string) => void;
  onSourceClick: (source: RabbitHoleSource) => void;
  onReset: () => void;
  onNavFromTool: (activeNodeId: string) => void;
  onClose: () => void;
  ensureEmptySession: () => Promise<SimpleResult & { sessionId?: string }>;
  onSessionCreated?: (sessionId: string) => void;
  className?: string;
};

export function RabbitHoleAssistantPanel({
  session,
  activeNode,
  isBusy,
  canGoBack,
  onNavigateBack,
  onBranchClick,
  onSourceClick,
  onReset,
  onNavFromTool,
  onClose,
  ensureEmptySession,
  onSessionCreated,
  className,
}: RabbitHoleAssistantPanelProps) {
  const aiBlockRef = useRef<HTMLDivElement>(null);
  const { displayInputRef } = useRabbitHoleDrawerDisplay(aiBlockRef, "full");

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

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquare aria-hidden className="size-4 text-muted-foreground" />
          Assistant
        </div>
        <button
          aria-label="Close assistant"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          type="button"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <RabbitHoleDrawerChat
          activeNode={activeNode}
          addToolApprovalResponse={chat.addToolOutput}
          aiAction={chat.aiAction}
          aiBlockRef={aiBlockRef}
          branches={session ? branches : []}
          canGoBack={canGoBack}
          aiScrollClassName="max-h-[min(70vh,42rem)]"
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
      </div>

      <RabbitHolePromptBar
        disabled={chat.bootstrapping}
        isBusy={isBusy || chat.isStreaming}
        isLoading={isBusy || chat.isStreaming}
        sendMessage={chat.sendChatMessage}
        status={chat.status}
        stop={chat.stop}
        onReset={onReset}
      />
    </div>
  );
}
