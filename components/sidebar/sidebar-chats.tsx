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
import { createLogger } from "@/util/logger";


const logger = createLogger(`components/sidebar/sidebar-chats.tsx`);


export const SidebarChats = () => {
  const [chats, setChats] = useState<ThreadLink[]>([]);

  useEffect(() => {
    async function fetchChats() {
      const fetchedChats = await getChats();
      if (fetchedChats.error || fetchedChats.data === null) {
        logger.error("fetchChats", `Error getting chats: ${fetchedChats.error?.message ?? "Unknown error"}`);
        return;
      }
      const threads = fetchedChats.data;

      const normalizedChats: ThreadLink[] = threads.map((thread) => ({
        title: thread.title ?? "Unknown title",
        id: thread.id,
        pinned: thread.pinned ?? false,
        date: new Date(thread.created_at).toISOString(),
      }));

      setChats(normalizedChats);
    }

    fetchChats();
  }, []);

  return (
    <>
      {chats.filter((t) => t.pinned).length > 0 && (
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
      )}
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
