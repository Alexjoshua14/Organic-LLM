"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { ChatMessage } from "./chat-message";
import { StickToBottom } from "use-stick-to-bottom";

type ChatThreadProps = {
  messages: UIMessage[];
};

export const ChatThread: FC<ChatThreadProps> = ({ messages }) => {
  // const { messages } = useChat()

  return (
    <StickToBottom.Content className="max-w-4xl w-full mx-auto  flex flex-col gap-2 px-8 pt-20 pb-44">
      {messages.map((message) => {
        return <ChatMessage key={message.id} message={message} />;
      })}
    </StickToBottom.Content>
  );
};
