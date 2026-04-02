import type { ExaSearchResultSource } from "@/lib/exa/types";

import { FC, memo, useEffect, useState } from "react";
import { UIMessage } from "ai";
import { Pin, PinOff, Trash2 } from "lucide-react";

import { ClipboardCopyButton } from "../shared/clipboardCopyButton";
import { TTSButton } from "../tts/ttsButton";
import { glass } from "../design-system/primitives";

import { PinToSpeakButton } from "./PinToSpeakButton";
import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatReasoning, ChatThinking, ChatSearching } from "./chat-loading";

import { cn } from "@/lib/utils";
import { ChatAIActionEnum } from "@/types/ai";
import { PinTargetType } from "@/lib/schemas/chat";

/**
 * When true, the current AI action (tool, search, reasoning, etc.) is shown
 * even while streamed text is already visible. Set to false to restore the
 * previous behavior (action only when no text has been streamed yet).
 */
const SHOW_ACTION_WHILE_STREAMING_TEXT = true;

type ChatMessageProps = {
  message: UIMessage;
  isLastMessage?: boolean;
  pinState?: {
    threadPinned: boolean;
    personaPinned: boolean;
  };
  personaPinEnabled?: boolean;
  onTogglePin?: (messageId: string, targetType: PinTargetType, shouldPin: boolean) => void;
  onDeleteMessage?: (messageId: string) => void;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
    sources?: ExaSearchResultSource[];
  };
};

export const ChatMessage = memo<ChatMessageProps>(
  ({ message, aiActionPayload, pinState, onTogglePin, personaPinEnabled, onDeleteMessage }) => {
  switch (message.role) {
    case "assistant":
      return (
        <AIMessage
          aiActionPayload={aiActionPayload}
          message={message}
          onDeleteMessage={onDeleteMessage}
          onTogglePin={onTogglePin}
          personaPinEnabled={personaPinEnabled}
          pinState={pinState}
        />
      );
    case "user":
      return (
        <UserMessage
          message={message}
          onDeleteMessage={onDeleteMessage}
          onTogglePin={onTogglePin}
          personaPinEnabled={personaPinEnabled}
          pinState={pinState}
        />
      );
    case "system":
      return <SystemMessage message={message} />;
  }
  }
);

ChatMessage.displayName = "ChatMessage";

const AIMessage: FC<ChatMessageProps> = ({
  message,
  aiActionPayload,
  onDeleteMessage,
  onTogglePin,
  personaPinEnabled,
  pinState,
}) => {
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
          <MessagePinControls
            messageId={message.id}
            onDeleteMessage={onDeleteMessage}
            onTogglePin={onTogglePin}
            personaPinEnabled={personaPinEnabled}
            pinState={pinState}
          />
        </div>
      )}
    </div>
  );
};

const COLLAPSED_LINES = 6;
const COLLAPSED_CHAR_THRESHOLD = 500;

function isLongUserMessage(text: string): boolean {
  const lines = text.split(/\n/).length;

  return lines > COLLAPSED_LINES || text.length > COLLAPSED_CHAR_THRESHOLD;
}

const UserMessage: FC<ChatMessageProps> = ({
  message,
  onDeleteMessage,
  onTogglePin,
  personaPinEnabled,
  pinState,
}) => {
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
      <div className="pt-2 opacity-80 hover:opacity-100 transition-opacity">
        <MessagePinControls
          messageId={message.id}
          onDeleteMessage={onDeleteMessage}
          onTogglePin={onTogglePin}
          personaPinEnabled={personaPinEnabled}
          pinState={pinState}
        />
      </div>
    </div>
  );
};

const MessagePinControls: FC<{
  messageId: string;
  pinState?: {
    threadPinned: boolean;
    personaPinned: boolean;
  };
  personaPinEnabled?: boolean;
  onTogglePin?: (messageId: string, targetType: PinTargetType, shouldPin: boolean) => void;
  onDeleteMessage?: (messageId: string) => void;
}> = ({ messageId, pinState, personaPinEnabled, onTogglePin, onDeleteMessage }) => {
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <button
        aria-label={pinState?.threadPinned ? "Unpin from thread context" : "Pin to thread context"}
        className={cn(
          "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
          pinState?.threadPinned
            ? "border-primary/40 text-primary"
            : "border-border/50 hover:text-foreground hover:border-border"
        )}
        type="button"
        onClick={() => onTogglePin?.(messageId, "thread", !pinState?.threadPinned)}
      >
        {pinState?.threadPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        <span>Thread</span>
      </button>
      <button
        aria-label={
          pinState?.personaPinned ? "Unpin from persona context" : "Pin to persona context"
        }
        className={cn(
          "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors",
          pinState?.personaPinned
            ? "border-primary/40 text-primary"
            : "border-border/50 hover:text-foreground hover:border-border",
          !personaPinEnabled && "opacity-50 cursor-not-allowed"
        )}
        disabled={!personaPinEnabled}
        title={!personaPinEnabled ? "Persona key not set for this thread yet." : undefined}
        type="button"
        onClick={() => onTogglePin?.(messageId, "persona", !pinState?.personaPinned)}
      >
        {pinState?.personaPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        <span>Persona</span>
      </button>
      <button
        aria-label="Delete message"
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border/50 hover:text-destructive hover:border-destructive/40 transition-colors"
        title="Delete message"
        type="button"
        onClick={() => onDeleteMessage?.(messageId)}
      >
        <Trash2 className="size-3.5" />
      </button>
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
