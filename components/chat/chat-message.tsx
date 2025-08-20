import { FC } from "react";
import { UIMessage } from "ai";

type ChatMessageProps = {
  message: UIMessage;
};

export const ChatMessage: FC<ChatMessageProps> = ({ message }) => {
  switch (message.role) {
    case "assistant":
      return <AIMessage message={message} />;
    case "user":
      return <UserMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
  }
};

const AIMessage: FC<ChatMessageProps> = ({ message }) => {
  return (
    <div className="rounded-lg p-4 mb-4 text-foreground">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return <div key={`${message.id}-${i}`}>{part.text}</div>;
        }
      })}
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
