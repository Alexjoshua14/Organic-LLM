"use client";

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
import type { SimpleResult } from "@/types";

import { useRef } from "react";
import { AudioLines, PhoneOff, X } from "lucide-react";

import { OrganicActivityMark } from "@/components/chat/organic-activity-mark";
import { glass } from "@/components/design-system/primitives";
import { RabbitHoleDrawerChat } from "@/components/rabbit-holes/mobile/RabbitHoleDrawerChat";
import { RabbitHolePromptBar } from "@/components/rabbit-holes/RabbitHolePromptBar";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { useRabbitHoleChatComposer } from "@/hooks/use-rabbit-hole-chat-composer";
import { useRabbitHoleDrawerDisplay } from "@/hooks/use-rabbit-hole-drawer-display";
import { cn } from "@/lib/utils";

export type RabbitHoleAssistantPanelProps = {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  isBusy: boolean;
  canGoBack: boolean;
  subagents?: readonly RabbitHoleSubagentMeshItem[];
  processingIntensity?: LlmProcessingIntensitySnapshot;
  planBudget?: RabbitHolePlanBudgetSummary | null;
  zeroDataRetention?: boolean;
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
  subagents,
  processingIntensity,
  planBudget,
  zeroDataRetention,
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

  const voice = useVoiceSessionOptional();

  const sources = activeNode?.sources ?? [];
  const branches =
    session?.generatingNodeId === activeNode?.id ? [] : (activeNode?.branchSuggestions ?? []);

  const effectiveIntensity = processingIntensity ?? chat.processingIntensity;
  const effectiveSubagents = subagents && subagents.length > 0 ? subagents : chat.subagents;
  const activeWorkerCount = effectiveSubagents.filter(
    (w) => w.status === "working" || w.status === "queued"
  ).length;
  const isWorking =
    isBusy ||
    chat.isStreaming ||
    activeWorkerCount > 0 ||
    effectiveIntensity?.markState === "working";
  const controllerMarkState = effectiveIntensity?.markState ?? (isWorking ? "working" : "idle");

  const isCallActive = Boolean(voice?.connected || voice?.connecting);
  const isCallPaused = Boolean(voice?.paused && !isCallActive);

  const handleVoiceTrigger = () => {
    if (!voice) return;
    if (voice.connected || voice.connecting) {
      voice.disconnect();
    } else if (voice.paused) {
      voice.resume();
    } else {
      voice.connect();
    }
  };

  return (
    <div
      data-rabbit-hole-controller
      className={cn("flex max-h-[calc(100dvh-7rem)] min-h-0 flex-col gap-3", className)}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 rounded-xl border border-border/40 px-3 py-2",
          glass()
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <OrganicActivityMark
            className="size-6 shrink-0 rounded-md"
            intensity={effectiveIntensity?.intensity ?? (isWorking ? 0.62 : undefined)}
            intensityTier={effectiveIntensity?.tier}
            label="Organic Agent controller activity"
            seed="rabbit-hole-controller-agent"
            size="sm"
            state={controllerMarkState}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">Organic Agent</span>
              <span className="rounded-full border border-border/50 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Controller
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            data-controller-voice-trigger
            aria-label={
              isCallActive
                ? "End live voice call"
                : isCallPaused
                  ? "Resume live voice call"
                  : "Jump on live voice call"
            }
            aria-pressed={isCallActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              isCallActive
                ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                : isCallPaused
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                  : "border-border/50 bg-background/70 text-foreground hover:bg-muted/50"
            )}
            type="button"
            onClick={handleVoiceTrigger}
          >
            {isCallActive ? (
              <>
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span>{voice?.connecting ? "Connecting…" : "On call"}</span>
                <PhoneOff aria-hidden className="size-3 opacity-80" />
              </>
            ) : (
              <>
                <AudioLines aria-hidden className="size-3.5 text-muted-foreground" />
                <span>{isCallPaused ? "Resume call" : "Jump on call"}</span>
              </>
            )}
          </button>

          <button
            aria-label="Close assistant"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
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
          planBudget={planBudget ?? chat.planBudget}
          processingIntensity={effectiveIntensity}
          session={session}
          sources={session ? sources : []}
          subagents={effectiveSubagents}
          zeroDataRetention={zeroDataRetention ?? chat.zeroDataRetention}
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
