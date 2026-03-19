import type { ExaSearchResultSource } from "@/lib/exa/types";

import { FC, memo, useCallback, useEffect, useMemo, useState } from "react";
import { UIMessage } from "ai";
import { Pin, PinOff } from "lucide-react";

import { ClipboardCopyButton } from "../shared/clipboardCopyButton";
import { TTSButton } from "../tts/ttsButton";
import { glass } from "../design-system/primitives";

import { PinToSpeakButton } from "./PinToSpeakButton";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatReasoning, ChatThinking, ChatSearching } from "./chat-loading";

import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";

/**
 * When true, the current AI action (tool, search, reasoning, etc.) is shown
 * even while streamed text is already visible. Set to false to restore the
 * previous behavior (action only when no text has been streamed yet).
 */
const SHOW_ACTION_WHILE_STREAMING_TEXT = true;

type ChatMessageProps = {
  message: UIMessage;
  isLastMessage?: boolean;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
};

export const ChatMessage: FC<ChatMessageProps> = memo(function ChatMessage({
  message,
  aiActionPayload,
}) {
  switch (message.role) {
    case "assistant":
      return (
        <AIMessage aiActionPayload={aiActionPayload} message={message} />
      );
    case "user":
      return <UserMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
  }
}) as unknown as FC<ChatMessageProps>;

ChatMessage.displayName = "ChatMessage";

const AIMessage: FC<ChatMessageProps> = ({ message, aiActionPayload }) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  useEffect(() => {
    if (aiActionPayload) {
      setIsStreaming(true);
    } else {
      setIsStreaming(false);
    }
  }, [aiActionPayload]);
  const text = message.parts
    .map((part) => {
      switch (part.type) {
        case "text":
          return part.text;
      }
    })
    .join("");

  return (
    <div className="group/ai-message rounded-lg p-4 flex flex-col gap-2">
      <div className="ai-message space-y-2 text-foreground max-w-full prose dark:prose-invert">
        {/* Streamed content: reasoning + text parts when present */}
        {message.parts.some((part) => part.type === "text") &&
          message.parts.map((part, i) => {
            switch (part.type) {
              case "reasoning":
                if (part.state === "streaming") {
                  return <ChatReasoning key={`${message.id}-${i}`} />;
                }

                return null;

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

        <ArcadiaToolOutputs messageId={message.id} parts={message.parts as unknown[]} />
        {/* Action indicator: when no text yet, show only action; when SHOW_ACTION_WHILE_STREAMING_TEXT, also show action below streamed text */}
        {aiActionPayload &&
          (!message.parts.some((part) => part.type === "text") ||
            SHOW_ACTION_WHILE_STREAMING_TEXT) && <ChatAIAction aiActionPayload={aiActionPayload} />}
      </div>
      {!isStreaming && (
        <div className="w-full flex gap-2 h-8">
          <TTSButton iconOnly text={text} />
          <PinToSpeakButton text={text} />
          <ClipboardCopyButton text={text} />
        </div>
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

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ArcadiaToolOutputs({ messageId, parts }: { messageId: string; parts: unknown[] }) {
  const toolParts = useMemo(() => parts.filter(isToolInvocationPart), [parts]);
  const [pinned, setPinned] = useState<Record<string, boolean>>({});

  const visible = useMemo(
    () => toolParts.filter((p) => p.state === "result" || p.state === "output-error"),
    [toolParts]
  );

  const togglePinned = useCallback((id: string) => {
    setPinned((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (visible.length === 0) return null;

  return (
    <div className="not-prose flex flex-col gap-2">
      {visible.map((p, idx) => {
        const isPinned = pinned[p.toolInvocationId] === true;
        const label = `${p.toolName}`;
        const body = p.state === "output-error" ? p.errorText : p.result;
        const json = stableStringify(body);

        return (
          <div
            key={`${messageId}-tool-${p.toolInvocationId}-${idx}`}
            className={cn(
              "rounded-lg border border-border/60 bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-blur-2xl",
              "px-3 py-2",
              isPinned && "sticky top-20 z-30 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground truncate">{label}</div>
              <button
                aria-label={isPinned ? "Unpin tool output" : "Pin tool output"}
                aria-pressed={isPinned}
                className={cn(
                  "h-7 w-7 grid place-content-center rounded",
                  "hover:bg-background-tertiary/60 transition-colors"
                )}
                type="button"
                onClick={() => togglePinned(p.toolInvocationId)}
              >
                {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </button>
            </div>

            <details className="mt-1">
              <summary className="cursor-pointer select-none text-xs text-foreground/80 hover:text-foreground">
                View output
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-snug text-foreground/90">
                {json}
              </pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}

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

const ChatAIAction: FC<ChatAIActionProps> = ({ aiActionPayload }) => {
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
            return <ChatThinking text="Searching memories..." />;
          case "tool":
            return <ChatThinking text="Using a tool..." />;
          default:
            return <ChatThinking />;
        }
      })()}
    </div>
  );
};
