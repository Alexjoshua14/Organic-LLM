import { FC, memo } from "react";
import { UIMessage } from "ai";

import { ClipboardCopyButton } from "../shared/clipboardCopyButton";
import { TTSButton } from "../tts/ttsButton";

import { ChatMessageMarkdown } from "./chat-message-markdown";
import { ChatLoading, ChatReasoning, ChatThinking } from "./chat-loading";

type ChatMessageProps = {
  message: UIMessage;
};

export const ChatMessage = memo<ChatMessageProps>(({ message }) => {
  console.log("Rendering ChatMessage: ", message.id, message.role);
  switch (message.role) {
    case "assistant":
      return <AIMessage message={message} />;
    case "user":
      return <UserMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
  }
});

ChatMessage.displayName = "ChatMessage";

const AIMessage: FC<ChatMessageProps> = ({ message }) => {
  const text = message.parts
    .map((part) => {
      switch (part.type) {
        case "text":
          if (part.state === "done") {
          }

          return part.text;
      }
    })
    .join("");

  return (
    <div className="group/ai-message rounded-lg p-4 flex flex-col gap-2">
      <div className="ai-message space-y-2 text-foreground max-w-full prose dark:prose-invert">
        {message.parts.length < 1 ? (
          <ChatThinking />
        ) : (
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
          })
        )}
      </div>
      <div className="w-full flex gap-2 h-8">
        <TTSButton iconOnly text={text} />
        <ClipboardCopyButton text={text} />
      </div>
    </div>
  );
};

const UserMessage: FC<ChatMessageProps> = ({ message }) => {
  return (
    <div className="max-w-4/5 w-fit rounded-lg p-4 mb-4 bg-background-tertiary text-foreground place-self-end">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return <div key={`${message.id}-${i}`}>{part.text}</div>;
        }
      })}
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
