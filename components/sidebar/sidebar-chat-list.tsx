"use client";

import { FC, useCallback } from "react";
import Link from "next/link";
import { Tooltip } from "@heroui/tooltip";
import { Pin, PinOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../third-party/ui/sidebar";

import SidebarDeleteThreadButton from "./sidebar-delete-thread-button";

import { updateChatPinned } from "@/data/supabase/chat";
import { ThreadLink } from "@/types";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { useChatId } from "@/hooks/use-chat-id";

const logger = createLogger("components/sidebar/sidebar-chat-list.tsx");

type SidebarChatListProps = {
  threads: ThreadLink[];
};

export const SidebarChatList: FC<SidebarChatListProps> = ({ threads }) => {
  const { setOpenMobile, isMobile } = useSidebar();
  const { chatId, setChatId } = useSharedChatContext(); //useState<string>()

  // Alternative way to get chatID based on pathname (this version works other doesn't currently)
  const currentChatId = useChatId()

  const togglePinThread = useCallback(
    async (thread: ThreadLink) => {
      logger.log("togglePinThread", `Toggling pin for thread: ${thread.title}`);
      const res = await updateChatPinned(thread.id, !thread.pinned);

      if (res.error) {
        logger.error(
          "togglePinThread",
          `Error toggling pin for thread: ${thread.title}`,
          res.error.message,
        );
      } else {
        if (window.refreshSidebar) {
          window.refreshSidebar();
        }
      }
    },
    [threads],
  );

  function shouldPrefetch(thread: ThreadLink): boolean {
    /* If thread is pinned */
    if (thread.pinned) return true;

    /* If thread was updated within last day */
    if (thread.date > new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
      return true;

    return false;
  }


  /**
   * TODO: Correct cursor pointer
   */
  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {threads.map((thread) => {
          return (
            <SidebarMenuItem key={thread.id} className="relative">
              <SidebarMenuButton asChild>
                <Link
                  about={`Open ${thread.title}`}
                  aria-label={`Open ${thread.title}`}
                  className={`font-extralight text-sm w-full rounded hover:bg-background px-3 transition-colors duration-150 group/thread overflow-hidden cursor-pointer`}
                  href={`/chat/${thread.id}`}
                  prefetch={shouldPrefetch(thread)}
                  onClick={() => {
                    setOpenMobile(false);
                    setChatId(thread.id);
                  }}
                >
                  <div className="w-full flex text-foreground-secondary">
                    <h3 className="flex-1 truncate py-1">{thread.title}</h3>
                    {!isMobile && (
                      <div className="relative w-14 z-10">
                        <div
                          className={`absolute -right-18 opacity-0 group-hover/thread:right-0 group-hover/thread:opacity-100 grid grid-cols-2 items-center transition-all duration-250 h-full`}
                        >
                          <Tooltip
                            closeDelay={50}
                            content={
                              thread.pinned ? "Unpin Thread" : "Pin Thread"
                            }
                            offset={1}
                            placement="bottom"
                            size="sm"
                          >
                            <button
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
                            </button>
                          </Tooltip>
                          <SidebarDeleteThreadButton thread={thread} />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              </SidebarMenuButton>
              <AnimatePresence>
                {currentChatId === thread.id && (
                  <motion.div
                    key={thread.id}
                    aria-hidden="true"
                    className="absolute top-0 right-0 w-full h-full z-20 pointer-events-none rounded-lg backdrop-brightness-110 dark:backdrop-brightness-150 border"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                )}
              </AnimatePresence>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  );
};
