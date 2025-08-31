"use client";

import { ThreadLink } from "@/types";
import { FC, useCallback } from "react";
import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import Link from "next/link";
import { Tooltip } from "@heroui/tooltip";
import { Pin, PinOff, XIcon } from "lucide-react";
import { updateChatPinned } from "@/data/supabase/chat";
import SidebarDeleteThreadButton from "./sidebar-delete-thread-button";

type SidebarChatListProps = {
  threads: ThreadLink[];
};

export const SidebarChatList: FC<SidebarChatListProps> = ({ threads }) => {
  const togglePinThread = useCallback(
    (thread: ThreadLink) => {
      console.log(`Toggling pin for thread: ${thread.title}`);
      updateChatPinned(thread.id, !thread.pinned);
    },
    [threads],
  );

  const handleDeleteThread = useCallback(
    (thread: ThreadLink) => {
      console.log(`Deleting thread: ${thread.title}`);


    },
    [threads],
  );

  function shouldPrefetch(thread: ThreadLink): boolean {
    if (thread.pinned) return true;

    return false;
  }

  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {threads.map((thread) => (
          <SidebarMenuItem key={thread.id}>
            <SidebarMenuButton asChild>
              <Link
                href={`/chat/${thread.id}`}
                className={`font-medium text-sm w-full rounded hover:bg-background px-3 transition-colors duration-150 group/thread overflow-hidden`}
                prefetch={shouldPrefetch(thread)}
              >
                <div className="w-full flex text-foreground-secondary">
                  <h3 className="flex-1 truncate py-1">{thread.title}</h3>
                  <div className="relative w-14 z-10">
                    <div
                      className={`absolute -right-18 opacity-0 group-hover/thread:right-0 group-hover/thread:opacity-100 grid grid-cols-2 items-center transition-all duration-250 h-full`}
                    >
                      <Tooltip
                        placement="bottom"
                        content={thread.pinned ? "Unpin Thread" : "Pin Thread"}
                        size="sm"
                        offset={1}
                        closeDelay={50}
                      >
                        <div
                          className="hover:bg-background-tertiary w-full h-full flex items-center justify-center rounded px-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePinThread(thread);
                          }}
                        >
                          {thread.pinned ? (
                            <PinOff size={18} />
                          ) : (
                            <Pin size={18} />
                          )}
                        </div>
                      </Tooltip>
                      <SidebarDeleteThreadButton thread={thread} />
                    </div>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  );
};
