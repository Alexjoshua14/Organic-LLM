import { FC, memo, useEffect, useState } from "react";
import { UIMessage } from "ai";

import { ClipboardCopyButton } from "../shared/clipboardCopyButton";
import { TTSButton } from "../tts/ttsButton";
import { glass } from "../design-system/primitives";

import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatReasoning, ChatThinking, ChatSearching } from "./chat-loading";
import { RippleText } from "../RippleText";
import { ChatAIActionEnum } from "@/types/ai";
import type { ExaSearchResultSource } from "@/lib/exa/types";

type ChatMessageProps = {
  message: UIMessage;
  isLastMessage?: boolean;
  aiActionPayload?: { action: ChatAIActionEnum; message?: string; sources?: ExaSearchResultSource[] };
};

export const ChatMessage = memo<ChatMessageProps>(({ message, aiActionPayload }) => {
  switch (message.role) {
    case "assistant":
      return <AIMessage message={message} aiActionPayload={aiActionPayload} />;
    case "user":
      return <UserMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
  }
});

ChatMessage.displayName = "ChatMessage";

const AIMessage: FC<ChatMessageProps> = ({ message, aiActionPayload }) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  useEffect(() => {
    if (aiActionPayload) {
      setIsStreaming(true);
    } else {
      setIsStreaming(false);
    }
  }, [aiActionPayload])
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
        {
          message.parts.some(part => part.type === "text") ? (
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
                  )
              }
            })
          ) : (
            <ChatAIAction aiActionPayload={aiActionPayload} />
          )}
      </div>
      {!isStreaming && (
        <div className="w-full flex gap-2 h-8">
          <TTSButton iconOnly text={text} />
          <ClipboardCopyButton text={text} />
        </div>
      )}
    </div>
  );
};

const UserMessage: FC<ChatMessageProps> = ({ message }) => {
  return (
    <div
      className={
        "max-w-4/5 w-fit mb-4 text-foreground place-self-end overflow-hidden"
      }
    >
      <div className={`${glass()} p-4 rounded-lg`}>
        {message.parts.map((part, i) => {
          switch (part.type) {
            case "text":
              // return <RippleText latestMessage={true} key={`${message.id}-${i}`} text={part.text} />;
              return <ChatMessageMarkdown
                key={`${message.id}-${i}`}
                content={part.text}
                id={message.id}
              />
          }
        })}
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
  aiActionPayload?: { action: ChatAIActionEnum; message?: string; sources?: ExaSearchResultSource[] };
};

const ChatAIAction: FC<ChatAIActionProps> = ({ aiActionPayload }) => {
  return (
    <div className="rounded-lg p-4 mb-4 text-foreground">
      {(() => {
        switch (aiActionPayload?.action) {
          case "reasoning":
            return <ChatReasoning />;
          case "processing":
            return <ChatThinking text={aiActionPayload?.message ?? "Processing..."} />
          case "search":
            return <ChatSearching text="Searching the web..." sources={aiActionPayload?.sources} />;
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