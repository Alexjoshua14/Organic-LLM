"use client";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@radix-ui/react-collapsible";
import { Pin, ChevronUp } from "lucide-react";
import { SidebarGroup, SidebarGroupLabel } from "../ui/sidebar";
import { SidebarChatList } from "./sidebar-chat-list";
import { useEffect, useState } from "react";
import { getChats } from "@/util/chat-store";
import { ThreadLink } from "@/types";

export const SidebarChats = () => {
  const [chats, setChats] = useState<ThreadLink[]>([]);

  useEffect(() => {
    async function fetchChats() {
      const fetchedChats = await getChats();

      const normalizedChats: ThreadLink[] = fetchedChats.map((chatId) => ({
        title: chatId,
        id: chatId,
        pinned: false,
        date: new Date().toISOString(),
      }));

      setChats(normalizedChats);
    }

    fetchChats();
  }, []);

  return (
    <>
      <Collapsible className="group/collapsible" defaultOpen>
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger>
              <div className="flex items-end gap-1 text-foreground">
                <Pin size={13} />
                <h2>Pinned</h2>
              </div>
              <ChevronUp className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarChatList threads={chats.filter((t) => t.pinned)} />
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
      <SidebarGroup>
        <SidebarGroupLabel>
          <div className="text-foreground">
            <h2>All Threads</h2>
          </div>
        </SidebarGroupLabel>
        <SidebarChatList threads={chats.filter((t) => !t.pinned)} />
      </SidebarGroup>
    </>
  );
};
