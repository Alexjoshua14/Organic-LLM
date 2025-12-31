"use client";

import { Chat } from "@/components/chat/chat";
import { Thread } from "@/lib/schemas/chat";
import { UIMessage } from "ai";

type ChatWrapperProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
  persona?: "prometheus" | "spark" | "aion";
  endpoint?: string;
};

export function ChatWrapper({
  chatData,
  persona,
  endpoint,
}: ChatWrapperProps) {
  return (
    <div className="w-full h-full">
      <Chat chatData={chatData} persona={persona} endpoint={endpoint} />
    </div>
  );
}

