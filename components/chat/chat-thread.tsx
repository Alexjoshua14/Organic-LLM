import { FC } from "react";
import { UIMessage } from "ai";
import { ChatMessage } from "./chat-message";

type ChatThreadProps = {
  messages: UIMessage[];
};

export const ChatThread: FC<ChatThreadProps> = ({ messages }) => {
  return (
    <section className="w-full h-full flex flex-col gap-2 p-8 overflow-y-auto pt-20 pb-60">
      {messages.map((message) => {
        return <ChatMessage key={message.id} message={message} />;
      })}
    </section>
  );
};
