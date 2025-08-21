"use client";

import { useChat } from "@ai-sdk/react";
import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";

type ChatProps = {
  chatId: string;
};

export const Chat: React.FC<ChatProps> = ({ chatId }) => {
  // const initialMessages: UIMessage[] = [];

  const { messages, sendMessage, id } = useChat();

  return (
    <div className="h-full w-full flex flex-col overflow-hidden items-center overflow-y-auto">
      {/*<div className="absolute top-0 w-full inline-block text-center justify-center p-4 bg-white/5 backdrop-blur-xl shadow">
      <span className={title()}>Welcome Chat ;)</span>
      <span className={subtitle()}>Chat ID: {chatId}</span>
    </div>*/}
      <ChatThread messages={messages} />

      <ChatInput id={id} sendMessage={sendMessage} />
    </div>
  );
};
