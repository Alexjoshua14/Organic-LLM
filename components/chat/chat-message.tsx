import { FC, useMemo, useState } from "react";
import { UIMessage } from "ai";

import { ClipboardCopyButton } from "../shared/clipboardCopyButton";
import { TTSButton } from "../tts/ttsButton";

import { ChatMessageMarkdown } from "./chat-message-markdown";

import { ChatLoading } from "./chat-loading";


type ChatMessageProps = {
  message: UIMessage;
};

export const ChatMessage: FC<ChatMessageProps> = ({ message }) => {
  switch (message.role) {
    case "assistant":
      return useMemo(() => <AIMessage message={message} />, [message]);
    case "user":
      return useMemo(() => <UserMessage message={message} />, [message]);
    case "system":
      return useMemo(() => <SystemMessage message={message} />, [message]);
  }
};

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
        {
          message.parts.length <= 1 &&
          <ChatLoading />

        }
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
