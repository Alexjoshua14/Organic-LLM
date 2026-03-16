"use client";

import { useRouter } from "next/navigation";

import { SidebarMenuButton } from "../third-party/ui/sidebar";

import { Logger } from "@/lib/logger";
import { createChat } from "@/lib/chat/chat-store";
import { useSharedChatContext } from "@/lib/context/chat-context";

const logger = new Logger(`components/sidebar/sidebar-new-chat.tsx`);

export const SidebarNewChat = () => {
  const router = useRouter();
  const { refreshSidebarChats } = useSharedChatContext();

  const handleNewChat = () => {
    async function createNewChat() {
      logger.log("handleNewChat", "New chat clicked");
      const res = await createChat();

      if (res.error || res.data === null) {
        logger.error("handleNewChat", "Error creating chat");

        return;
      }

      const id = res.data;

      refreshSidebarChats();
      router.push(`/chat/${id}`);
    }

    createNewChat();
  };

  return (
    <SidebarMenuButton
      className="w-full rounded bg-background-tertiary cursor-pointer flex items-center justify-center py-5 px-4 text-sm font-medium"
      tooltip="Create a new chat"
      onClick={handleNewChat}
    >
      New Chat
    </SidebarMenuButton>
  );
};
