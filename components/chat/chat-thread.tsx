"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";
import type { ChatStatus, UIMessage } from "ai";

import { FC, Fragment, useId } from "react";

import { ConversationContent } from "../third-party/ai-elements/conversation";

import { ChatAIAction, ChatMessage } from "./chat-message";
import {
  ActiveSubagentStrip,
  InlineSubagentActivity,
  revealSubagentActivity,
} from "./subagent-activity";

import { useArcadiaMultitaskOptional } from "@/app/sandbox/arcadia/_components/multitask-provider";
import {
  inlineSubagentDispatch,
  liveAgentForDispatch,
} from "@/lib/arcadia/multitask/inline-dispatches";

import { ChatEmptyStateGuide } from "@/components/onboarding/chat-empty-state-guide";
import { ARCADIA_HELP_LATEST_ONLY, isArcadiaHelpMessage } from "@/lib/arcadia/help-response";
import { resolveThreadLiveAiAction } from "@/lib/chat/optimistic-ai-action";
import { ChatAIActionEnum } from "@/types/ai";
import { cn } from "@/lib/utils";
import { getAssistantModelSummary } from "@/lib/chat/message-model";

/** Bottom padding to reserve when memory (ephemeral cards) can appear. Use same value always to avoid layout shift. */
export const MEMORY_PANEL_RESERVE_PADDING = "pb-40";

type ChatThreadProps = {
  messages: UIMessage[];
  /** Owning thread id; forwarded to messages for stateful gen-UI (Ergon kanban). */
  chatId?: string;
  variant?: "default" | "compact";
  className?: string;
  /** Extra class for the scrollable content (e.g. bottom padding when memory panel can overlay). */
  contentClassName?: string;
  /** useChat status — drives the on-device receipt before stream bytes arrive. */
  status?: ChatStatus;
  /**
   * Forwarded to ChatMessage. Showcase pages pass false to hide paid TTS actions.
   * @default true
   */
  showActions?: boolean;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
  /** When set and there are no messages, replaces the default empty state (e.g. Noesis starters). */
  renderEmptyState?: () => React.ReactNode;
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  chatId,
  className,
  contentClassName,
  status,
  showActions = true,
  aiActionPayload,
  renderEmptyState,
}) => {
  const activityId = useId();
  const multitask = useArcadiaMultitaskOptional();
  const agents =
    multitask && chatId === multitask.orchestratorThreadId && !multitask.viewingSubagentId
      ? multitask.agents
      : null;
  const dispatchesByMessage = new Map(
    messages.map((message) => [
      message.id,
      agents && message.role === "assistant"
        ? message.parts.flatMap((part) => {
            const dispatch = inlineSubagentDispatch(part);
            return dispatch ? [dispatch] : [];
          })
        : [],
    ])
  );
  const dispatches = [...dispatchesByMessage.values()].flat();
  const rowId = (key: string) => `${activityId}-subagent-${key}`;
  // Older/direct assignments may have no retained dispatch tool in the parent conversation.
  const unplacedAgents = (agents ?? []).filter(
    (agent) =>
      (agent.threadId || agent.status === "working" || agent.status === "blocked") &&
      !dispatches.some(
        (dispatch) => dispatch.agentId === agent.id && dispatch.goalId === agent.latestGoalId
      )
  );
  const lastMessageIndex = messages.length - 1;
  const liveAiAction = resolveThreadLiveAiAction({
    lastMessageRole: messages[lastMessageIndex]?.role,
    status,
    aiActionPayload,
  });
  const modelSummary = getAssistantModelSummary(messages);

  const lastArcadiaHelpMessageId =
    ARCADIA_HELP_LATEST_ONLY &&
    (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (isArcadiaHelpMessage(messages[i])) return messages[i].id ?? null;
      }

      return null;
    })();

  return (
    <>
      {agents && (
        <ActiveSubagentStrip
          agents={agents}
          onReveal={(agent) => {
            const dispatch = dispatches.find(
              (item) => item.agentId === agent.id && item.goalId === agent.latestGoalId
            );
            revealSubagentActivity(rowId(dispatch ? dispatch.goalId : `current-${agent.id}`));
          }}
        />
      )}
      <ConversationContent
        className={cn(
          "flex w-full flex-col px-4 pb-4 pt-8",
          renderEmptyState && messages.length === 0
            ? "min-h-0 flex-1 justify-center pt-4 pb-2"
            : "pb-12 pt-16",
          contentClassName,
          className
        )}
        scrollClassName="min-h-0 flex-1 touch-manipulation w-full min-w-0 [scrollbar-gutter:stable]! overflow-x-hidden"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-232 flex-col",
            renderEmptyState && messages.length === 0 ? "gap-0" : "gap-8"
          )}
        >
          {modelSummary.shouldUseThreadBadge && modelSummary.label ? (
            <div className="flex justify-end -mb-3">
              <span className="rounded-full border border-border/50 bg-background-tertiary/35 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                LLM · {modelSummary.label}
              </span>
            </div>
          ) : null}
          {messages.length === 0 ? (
            renderEmptyState ? (
              renderEmptyState()
            ) : (
              <ChatEmptyStateGuide />
            )
          ) : (
            messages.map((message, index) => {
              const isLatestArcadiaHelp =
                !ARCADIA_HELP_LATEST_ONLY ||
                (lastArcadiaHelpMessageId != null && message.id === lastArcadiaHelpMessageId);

              const messageDispatches = dispatchesByMessage.get(message.id) ?? [];
              const displayMessage =
                messageDispatches.length > 0
                  ? {
                      ...message,
                      parts: message.parts.filter((part) => !inlineSubagentDispatch(part)),
                    }
                  : message;

              return (
                <Fragment key={message.id}>
                  {displayMessage.parts.some((part) => part.type !== "step-start") && (
                    <ChatMessage
                      aiActionPayload={
                        index === lastMessageIndex && liveAiAction.placement === "last-message"
                          ? liveAiAction.payload
                          : undefined
                      }
                      chatId={chatId}
                      isLatestArcadiaHelp={
                        isArcadiaHelpMessage(message) ? isLatestArcadiaHelp : undefined
                      }
                      message={displayMessage}
                      showActions={showActions}
                      showModelBadge={!modelSummary.shouldUseThreadBadge}
                    />
                  )}
                  {messageDispatches.length > 0 && (
                    <div className="space-y-stack-sm px-4" aria-label="Delegated work">
                      {messageDispatches.map((dispatch) => (
                        <InlineSubagentActivity
                          key={dispatch.toolCallId}
                          id={rowId(dispatch.goalId)}
                          dispatch={dispatch}
                          agent={liveAgentForDispatch(dispatch, agents ?? [])}
                          threadId={
                            dispatch.threadId ??
                            agents?.find((agent) => agent.id === dispatch.agentId)?.threadId
                          }
                        />
                      ))}
                    </div>
                  )}
                </Fragment>
              );
            })
          )}
          {unplacedAgents.length > 0 && (
            <div className="space-y-stack-sm px-4" aria-label="Subagent activity">
              {unplacedAgents.map((agent) => (
                <InlineSubagentActivity
                  key={agent.id}
                  id={rowId(`current-${agent.id}`)}
                  agent={agent}
                />
              ))}
            </div>
          )}
          {liveAiAction.placement === "after-user" && liveAiAction.payload ? (
            <div className="group/ai-message flex flex-col gap-2 rounded-lg p-4">
              <div className="ai-message max-w-full space-y-2 text-foreground">
                <ChatAIAction aiActionPayload={liveAiAction.payload} />
              </div>
            </div>
          ) : null}
        </div>
      </ConversationContent>
    </>
  );
};
