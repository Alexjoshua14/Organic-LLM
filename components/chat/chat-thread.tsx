"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { StickToBottom } from "use-stick-to-bottom";

import { ChatMessage } from "./chat-message";

type ChatThreadProps = {
  messages: UIMessage[];
  variant?: "default" | "compact";
};

export const ChatThread: FC<ChatThreadProps> = ({
  messages,
  variant = "default",
}) => {
  // const { messages } = useChat()

  return (
    <StickToBottom.Content
      className={`w-full mx-auto  flex flex-col gap-2 px-8 pt-20 pb-24 md:pb-40 ${variant === "default" ? "max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl" : "max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl"} `}
    >
      {messages.map((message) => {
        return <ChatMessage key={message.id} message={message} />;
      })}
    </StickToBottom.Content>
  );
};
