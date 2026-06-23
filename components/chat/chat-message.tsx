import type { ExaSearchResultSource } from "@/lib/exa/types";

import { FC, memo, useCallback, useState } from "react";
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, UIMessage } from "ai";

import { glass } from "../design-system/primitives";

import { AssistantMessageActions } from "./assistant-message-actions";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ArcadiaHelpMessage } from "./arcadia-help-message";
import { ChatReasoning, ChatThinking, ChatSearching } from "./chat-loading";
import {
  FullChatHistoryToolResultCard,
  tryParseFullChatHistoryToolOutput,
} from "./full-chat-history-tool-result";
import {
  GetMoreChatHistoryToolResultCard,
  tryParseGetMoreChatHistoryToolOutput,
} from "./get-more-chat-history-tool-result";
import { MermaidToolAckCard, tryParseMermaidToolOutput } from "./mermaid-tool-ack-card";
import {
  MemorySearchToolResultCard,
  tryParseMemorySearchToolOutput,
} from "./memory-search-tool-result";
import { tryParseWebSearchToolOutput, WebSearchToolResultCard } from "./web-search-tool-result";
import {
  ToolResultInlineRow,
  ToolResultPinButton,
  toolResultExpandedDetailClass,
  toolResultSummaryButtonClass,
} from "./tool-result-inline";

import { ErgonTaskResult } from "@/components/ergon/ErgonTaskResult";
import { GenUIStreamingPart } from "@/components/chat/gen-ui/GenUIStreamingPart";
import { GenUIToolResult } from "@/components/chat/gen-ui/GenUIToolResult";
import { KanbanLoadingShell } from "@/components/chat/kanban/KanbanLoadingShell";
import { KanbanToolResult } from "@/components/chat/kanban/KanbanToolResult";
import { ARCADIA_HELP_PREFIX } from "@/lib/arcadia/help-response";
import { messagePartsToCopyMarkdown } from "@/lib/chat/message-copy-markdown";
import { RENDER_GEN_UI_TOOL_NAME } from "@/lib/llm/gen-ui-tool";
import { KANBAN_BOARD_TOOL_NAME } from "@/lib/llm/kanban-tool";
import { MANAGE_TASKS_TOOL_NAME } from "@/lib/schemas/ergon-tasks";
import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { getMessageModelId, getModelDisplayName } from "@/lib/chat/message-model";

type ChatMessageProps = {
  message: UIMessage;
  /** Owning thread id; required for stateful gen-UI like the Ergon kanban board. */
  chatId?: string;
  isLastMessage?: boolean;
  showModelBadge?: boolean;
  /** When true, show custom Arcadia help UI; when false, show markdown. Omitted for non-help messages. */
  isLatestArcadiaHelp?: boolean;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
};

export const ChatMessage = memo<ChatMessageProps>(function ChatMessage(props) {
  const { message, chatId, aiActionPayload, isLatestArcadiaHelp, showModelBadge } = props;

  switch (message.role) {
    case "assistant":
      return (
        <AIMessage
          aiActionPayload={aiActionPayload}
          chatId={chatId}
          isLatestArcadiaHelp={isLatestArcadiaHelp}
          message={message}
          showModelBadge={showModelBadge}
        />
      );
    case "user":
      return <UserMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
  }
});

ChatMessage.displayName = "ChatMessage";

const AIMessage: FC<ChatMessageProps> = ({
  message,
  chatId,
  aiActionPayload,
  isLatestArcadiaHelp,
  showModelBadge,
}) => {
  const [pinnedToolIds, setPinnedToolIds] = useState<Record<string, boolean>>({});

  const toggleToolPinned = useCallback((toolInvocationId: string) => {
    setPinnedToolIds((prev) => ({ ...prev, [toolInvocationId]: !prev[toolInvocationId] }));
  }, []);

  const copyMarkdown = messagePartsToCopyMarkdown(message.parts);
  const text = copyMarkdown;
  const isArcadiaHelp = text.startsWith(ARCADIA_HELP_PREFIX);
  const showCustomArcadiaHelp =
    isArcadiaHelp && (isLatestArcadiaHelp === undefined || isLatestArcadiaHelp);

  const partsUnknown = message.parts as unknown[];
  const isActivelyStreaming =
    Boolean(aiActionPayload) || messagePartsIndicateStreaming(message.parts);
  const modelLabel = showModelBadge ? getModelDisplayName(getMessageModelId(message)) : null;

  let arcadiaHelpRendered = false;

  return (
    <div className="group/ai-message rounded-lg p-4 flex flex-col gap-2">
      {modelLabel ? (
        <div className="not-prose mb-1 flex justify-start">
          <span className="rounded-full border border-border/50 bg-background-tertiary/35 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            LLM · {modelLabel}
          </span>
        </div>
      ) : null}
      <div className="ai-message space-y-2 text-foreground max-w-full prose dark:prose-invert">
        {message.parts.map((part, i) => {
          switch (part.type) {
            case "reasoning":
              if (part.state === "streaming") {
                return <ChatReasoning key={`${message.id}-${i}`} />;
              }

              return null;

            case "text":
              if (showCustomArcadiaHelp) {
                if (arcadiaHelpRendered) return null;
                arcadiaHelpRendered = true;

                return <ArcadiaHelpMessage key={`${message.id}-${i}`} />;
              }

              return (
                <ChatMessageMarkdown
                  key={`${message.id}-${i}`}
                  content={part.text}
                  id={message.id}
                />
              );

            default:
              if (isToolOrDynamicToolUIPart(part)) {
                const toolName = getToolOrDynamicToolName(part);
                const toolCallId = part.toolCallId;

                if (toolName === KANBAN_BOARD_TOOL_NAME) {
                  if (part.state === "input-streaming" || part.state === "input-available") {
                    return <KanbanLoadingShell key={`${message.id}-${i}-kanban-stream`} />;
                  }
                  if (part.state === "output-available") {
                    return (
                      <KanbanToolResult
                        key={`${message.id}-${i}-kanban-result`}
                        output={part.output}
                        threadId={chatId ?? message.id}
                      />
                    );
                  }

                  return null;
                }

                if (toolName === MANAGE_TASKS_TOOL_NAME) {
                  if (part.state === "output-available") {
                    return (
                      <ErgonTaskResult
                        key={`${message.id}-${i}-ergon-tasks`}
                        output={part.output}
                      />
                    );
                  }

                  return null;
                }

                if (toolName === RENDER_GEN_UI_TOOL_NAME) {
                  if (part.state === "input-streaming" || part.state === "input-available") {
                    return (
                      <GenUIStreamingPart
                        key={`${message.id}-${i}-gen-ui-stream`}
                        input={"input" in part ? part.input : undefined}
                      />
                    );
                  }
                  if (part.state === "output-available") {
                    return (
                      <GenUIToolResult
                        key={`${message.id}-${i}-gen-ui-result`}
                        artifactSource={
                          chatId
                            ? {
                                threadId: chatId,
                                messageId: message.id,
                                toolCallId: toolCallId,
                              }
                            : undefined
                        }
                        messageId={message.id}
                        output={part.output}
                        partIndex={i}
                      />
                    );
                  }
                  if (part.state === "output-error") {
                    return (
                      <GenUIToolResult
                        key={`${message.id}-${i}-gen-ui-error`}
                        messageId={message.id}
                        output={part.errorText}
                        partIndex={i}
                      />
                    );
                  }

                  return null;
                }

                if (part.state === "input-streaming" || part.state === "input-available") {
                  return (
                    <div
                      key={`${message.id}-${i}-tool-active`}
                      className="not-prose rounded-lg border border-border/40 bg-background-tertiary/20 px-3 py-2"
                    >
                      <ChatThinking text={toolInvocationInFlightLabel(toolName)} />
                    </div>
                  );
                }
                if (part.state === "output-available") {
                  return (
                    <ArcadiaToolResultCard
                      key={`${message.id}-${i}-tool-result`}
                      displayBody={part.output}
                      isPinned={pinnedToolIds[toolCallId] === true}
                      toolName={toolName}
                      onTogglePin={() => toggleToolPinned(toolCallId)}
                    />
                  );
                }
                if (part.state === "output-error") {
                  return (
                    <ArcadiaToolResultCard
                      key={`${message.id}-${i}-tool-result`}
                      displayBody={part.errorText}
                      isPinned={pinnedToolIds[toolCallId] === true}
                      toolName={toolName}
                      onTogglePin={() => toggleToolPinned(toolCallId)}
                    />
                  );
                }

                return null;
              }
              const legacyTool = part as unknown;

              if (isToolInvocationPart(legacyTool)) {
                const tp = legacyTool;

                if (tp.state === "partial-call" || tp.state === "call") {
                  return (
                    <div
                      key={`${message.id}-${i}-tool-active`}
                      className="not-prose rounded-lg border border-border/40 bg-background-tertiary/20 px-3 py-2"
                    >
                      <ChatThinking text={toolInvocationInFlightLabel(tp.toolName)} />
                    </div>
                  );
                }
                if (tp.state === "result" || tp.state === "output-error") {
                  return (
                    <ArcadiaToolResultCard
                      key={`${message.id}-${i}-tool-result`}
                      displayBody={tp.state === "output-error" ? tp.errorText : tp.result}
                      isPinned={pinnedToolIds[tp.toolInvocationId] === true}
                      toolName={tp.toolName}
                      onTogglePin={() => toggleToolPinned(tp.toolInvocationId)}
                    />
                  );
                }
              }

              return null;
          }
        })}

        {aiActionPayload && shouldShowTailAiAction(aiActionPayload, partsUnknown) && (
          <ChatAIAction aiActionPayload={aiActionPayload} />
        )}
      </div>
      {!isActivelyStreaming && (
        <AssistantMessageActions showPinAndCopy={!showCustomArcadiaHelp} text={text} />
      )}
    </div>
  );
};

type ToolInvocationPartLike = {
  type: "tool-invocation";
  toolInvocationId: string;
  toolName: string;
  state: "partial-call" | "call" | "result" | "output-error";
  args?: unknown;
  result?: unknown;
  errorText?: string;
};

function isToolInvocationPart(part: unknown): part is ToolInvocationPartLike {
  if (!part || typeof part !== "object") return false;
  const p = part as Record<string, unknown>;

  return p.type === "tool-invocation" && typeof p.toolInvocationId === "string";
}

function messagePartsIndicateStreaming(parts: UIMessage["parts"]): boolean {
  for (const p of parts) {
    if (p.type === "reasoning" && p.state === "streaming") return true;
    if (p.type === "text" && "state" in p && (p as { state?: string }).state === "streaming") {
      return true;
    }
    if (isToolOrDynamicToolUIPart(p)) {
      if (p.state === "input-streaming" || p.state === "input-available") return true;
    } else if (isToolInvocationPart(p)) {
      const lt = p as unknown as ToolInvocationPartLike;

      if (lt.state === "partial-call" || lt.state === "call") return true;
    }
  }

  return false;
}

function partListHasStreamingReasoning(parts: unknown[]): boolean {
  return parts.some(
    (p) =>
      p &&
      typeof p === "object" &&
      (p as { type?: string }).type === "reasoning" &&
      (p as { state?: string }).state === "streaming"
  );
}

/** True when the message already has inline tool UI (loading or result). */
function partListHasToolUIPart(parts: unknown[]): boolean {
  return parts.some((p) => {
    if (!p || typeof p !== "object") return false;
    const up = p as UIMessage["parts"][number];

    if (isToolOrDynamicToolUIPart(up)) {
      return true;
    }

    return isToolInvocationPart(p);
  });
}

function partListHasMemorySearchToolPart(parts: unknown[]): boolean {
  const names = new Set(["search_memories", "memory_search"]);

  return parts.some((p) => {
    if (!p || typeof p !== "object") return false;
    const up = p as UIMessage["parts"][number];

    if (isToolOrDynamicToolUIPart(up)) {
      return names.has(getToolOrDynamicToolName(up).toLowerCase());
    }

    return isToolInvocationPart(p) && names.has(p.toolName.toLowerCase());
  });
}

function partListHasInFlightWebSearch(parts: unknown[]): boolean {
  return parts.some((p) => {
    if (!p || typeof p !== "object") return false;
    const up = p as UIMessage["parts"][number];

    if (isToolOrDynamicToolUIPart(up)) {
      const inFlight = up.state === "input-streaming" || up.state === "input-available";

      return inFlight && getToolOrDynamicToolName(up).toLowerCase() === "web_search";
    }

    return (
      isToolInvocationPart(p) &&
      (p.state === "partial-call" || p.state === "call") &&
      p.toolName.toLowerCase() === "web_search"
    );
  });
}

function shouldShowTailAiAction(
  payload: NonNullable<ChatMessageProps["aiActionPayload"]>,
  parts: unknown[]
): boolean {
  switch (payload.action) {
    case ChatAIActionEnum.Processing:
      return true;
    case ChatAIActionEnum.Search:
      if (
        partListHasInFlightWebSearch(parts) &&
        (!payload.sources || payload.sources.length === 0)
      ) {
        return false;
      }

      return true;
    case ChatAIActionEnum.Memory:
      // Inline memory-search tool parts own loading/result UI.
      return !partListHasMemorySearchToolPart(parts);
    case ChatAIActionEnum.Tool:
      // Inline tool parts own loading/result UI; tail shimmer only covers the gap before parts arrive.
      return !partListHasToolUIPart(parts);
    case ChatAIActionEnum.Reasoning:
      return !partListHasStreamingReasoning(parts);
    case ChatAIActionEnum.Errored:
      return false;
    default:
      return true;
  }
}

const KNOWN_TOOL_IN_FLIGHT_LABELS: Record<string, string> = {
  render_gen_ui: "Structuring response…",
  kanban_board: "Updating board…",
  manage_tasks: "Updating tasks…",
  make_mermaid_diagram: "Creating diagram...",
  search_memories: "Searching memories...",
  memory_search: "Searching memories...",
  web_search: "Searching the web...",
  get_full_chat_history: "Getting full chat history...",
  get_more_chat_history: "Getting more chat history...",
  get_messages_from_date: "Getting chat history for that date...",
};

function toolInvocationInFlightLabel(toolName: string): string {
  const key = toolName.toLowerCase();

  if (KNOWN_TOOL_IN_FLIGHT_LABELS[key]) return KNOWN_TOOL_IN_FLIGHT_LABELS[key];
  const readable = toolName.replace(/_/g, " ").replace(/-/g, " ").trim();

  if (readable.length > 0) {
    return `${readable[0].toUpperCase()}${readable.slice(1)}...`;
  }

  return "Using a tool...";
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractMermaidCode(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      trimmed.startsWith("graph") ||
      trimmed.startsWith("flowchart") ||
      trimmed.startsWith("sequenceDiagram")
    ) {
      return trimmed;
    }
    const fenceMatch = trimmed.match(/```mermaid\s*([\s\S]*?)```/i);

    if (fenceMatch?.[1]) return fenceMatch[1].trim();

    return null;
  }
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const code = v.code;

    if (typeof code === "string") return code.trim();
  }

  return null;
}

/** Generic collapsible tool output (JSON / Mermaid); specialized tools use dedicated cards. */
export const ArcadiaToolResultCard = memo(function ArcadiaToolResultCard({
  toolName,
  displayBody,
  isPinned,
  onTogglePin,
}: {
  toolName: string;
  displayBody: unknown;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (toolName.toLowerCase() === "web_search") {
    const parsed = tryParseWebSearchToolOutput(displayBody);

    if (parsed !== null) {
      return (
        <WebSearchToolResultCard isPinned={isPinned} parsed={parsed} onTogglePin={onTogglePin} />
      );
    }
  }

  if (toolName.toLowerCase() === "get_full_chat_history") {
    const parsed = tryParseFullChatHistoryToolOutput(displayBody);

    if (parsed !== null) {
      return (
        <FullChatHistoryToolResultCard
          isPinned={isPinned}
          parsed={parsed}
          onTogglePin={onTogglePin}
        />
      );
    }
  }

  if (toolName.toLowerCase() === "get_more_chat_history") {
    const parsed = tryParseGetMoreChatHistoryToolOutput(displayBody);

    if (parsed !== null) {
      return <GetMoreChatHistoryToolResultCard parsed={parsed} />;
    }
  }

  if (toolName.toLowerCase() === "search_memories") {
    const parsed = tryParseMemorySearchToolOutput(displayBody);

    if (parsed !== null) {
      return (
        <MemorySearchToolResultCard isPinned={isPinned} parsed={parsed} onTogglePin={onTogglePin} />
      );
    }
  }

  if (toolName.toLowerCase() === "make_mermaid_diagram") {
    const parsed = tryParseMermaidToolOutput(displayBody) ?? {
      kind: "error" as const,
      message: "Unexpected tool output.",
    };

    return <MermaidToolAckCard isPinned={isPinned} parsed={parsed} onTogglePin={onTogglePin} />;
  }

  const label =
    toolName.toLowerCase() === "web_search"
      ? "Search Results"
      : toolName.toLowerCase() === "get_full_chat_history"
        ? "Fetched full chat history"
        : toolName.toLowerCase() === "search_memories"
          ? "Memory search"
          : toolName.toLowerCase() === "make_mermaid_diagram"
            ? "Mermaid diagram"
            : `${toolName}`;
  const mermaid = extractMermaidCode(displayBody);
  const json = stableStringify(displayBody);

  return (
    <ToolResultInlineRow
      isPinned={isPinned}
      pin={<ToolResultPinButton isPinned={isPinned} onTogglePin={onTogglePin} />}
    >
      <button
        className={toolResultSummaryButtonClass}
        type="button"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="truncate">{label}</span>
        {expanded ? (
          <span className={`${toolResultExpandedDetailClass} block`}>
            {mermaid ? (
              <div className="mt-1">
                <MermaidDiagram code={mermaid} expandOnDoubleClick />
              </div>
            ) : null}
            <pre className="mt-1 max-h-72 overflow-auto rounded bg-background/60 p-2 text-[10px] leading-snug text-foreground/90">
              {json}
            </pre>
          </span>
        ) : null}
      </button>
    </ToolResultInlineRow>
  );
});

ArcadiaToolResultCard.displayName = "ArcadiaToolResultCard";

const COLLAPSED_LINES = 6;
const COLLAPSED_CHAR_THRESHOLD = 500;

function isLongUserMessage(text: string): boolean {
  const lines = text.split(/\n/).length;

  return lines > COLLAPSED_LINES || text.length > COLLAPSED_CHAR_THRESHOLD;
}

const UserMessage: FC<ChatMessageProps> = ({ message }) => {
  const [expanded, setExpanded] = useState(false);
  const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  const long = isLongUserMessage(text);

  return (
    <div className={"max-w-4/5 w-fit mb-4 text-foreground place-self-end overflow-hidden"}>
      <div className={`${glass()} p-4 rounded-lg`}>
        <div className={cn(long && !expanded && "line-clamp-6")}>
          {message.parts.map((part, i) => {
            switch (part.type) {
              case "text":
                return (
                  <ChatMessageMarkdown
                    key={`${message.id}-${i}`}
                    content={part.text}
                    id={message.id}
                  />
                );
            }
          })}
        </div>
        {long && (
          <button
            className="mt-2 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            type="button"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
};

const SystemMessage: FC<ChatMessageProps> = ({ message }) => {
  return (
    <div className="rounded-lg p-4 mb-4 bg-background-tertiary text-foreground">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return <div key={`${message.id}-${i}`}>{part.text}</div>;
        }
      })}
    </div>
  );
};

type ChatAIActionProps = {
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
};

/** Human-readable label for generic "Using tool: …" chunks from the API. */
function toolActionDisplayText(message: string | undefined): string {
  const trimmed = message?.trim();

  if (!trimmed) return "Using a tool...";

  const usingToolMatch = trimmed.match(/^Using tool:\s*([a-z0-9_]+)$/i);

  if (usingToolMatch?.[1]) {
    const toolName = usingToolMatch[1].toLowerCase();
    const knownLabels: Record<string, string> = {
      make_mermaid_diagram: "Creating diagram...",
      search_memories: "Searching memories...",
      web_search: "Searching the web...",
      get_full_chat_history: "Getting full chat history...",
      get_more_chat_history: "Getting more chat history...",
      get_messages_from_date: "Getting chat history for that date...",
    };

    if (knownLabels[toolName]) {
      return knownLabels[toolName];
    }

    const readableToolName = toolName.replace(/_/g, " ").trim();

    if (readableToolName.length > 0) {
      return `${readableToolName[0].toUpperCase()}${readableToolName.slice(1)}...`;
    }
  }

  return trimmed;
}

/** Ephemeral “tail” UI driven by `data-aiAction` (processing, search sources, memory, tool label, etc.). */
export const ChatAIAction: FC<ChatAIActionProps> = ({ aiActionPayload }) => {
  return (
    <div className="rounded-lg p-4 mb-4 text-foreground">
      {(() => {
        switch (aiActionPayload?.action) {
          case "reasoning":
            return <ChatReasoning />;
          case "processing":
            return <ChatThinking text={aiActionPayload?.message ?? "Processing..."} />;
          case "search":
            return <ChatSearching sources={aiActionPayload?.sources} text="Searching the web..." />;
          case "memory":
            return (
              <ChatThinking text={aiActionPayload?.message?.trim() || "Searching memories..."} />
            );
          case "tool":
            return <ChatThinking text={toolActionDisplayText(aiActionPayload?.message)} />;
          default:
            return <ChatThinking />;
        }
      })()}
    </div>
  );
};
