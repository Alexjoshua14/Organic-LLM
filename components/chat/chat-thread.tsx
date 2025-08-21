"use client";

import { FC } from "react";
import { UIMessage } from "ai";
import { ChatMessage } from "./chat-message";

type ChatThreadProps = {
  messages: UIMessage[];
};

export const ChatThread: FC<ChatThreadProps> = ({ messages }) => {
  // const { messages } = useChat()

  return (
    <section className="max-w-4xl w-full h-fit flex flex-col gap-2 px-8 pt-20 pb-40">
      {messages.map((message) => {
        return <ChatMessage key={message.id} message={message} />;
      })}
    </section>
  );
};
