"use client";

import { FC, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../third-party/ui/sidebar";

import { updateChatPinned, updateChatTitle } from "@/data/supabase/chat";
import { ThreadLink } from "@/types";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { useChatId } from "@/hooks/use-chat-id";
import { SidebarThreadActionsMenu } from "@/components/sidebar/sidebar-thread-actions-menu";
import { SidebarChatTitle } from "@/components/sidebar/sidebar-chat-title";

const logger = createLogger("components/sidebar/sidebar-chat-list.tsx");

const LONG_PRESS_MS = 500;

type SidebarChatListProps = {
  threads: ThreadLink[];
};

export const SidebarChatList: FC<SidebarChatListProps> = ({ threads }) => {
  const { setOpenMobile, isMobile } = useSidebar();
  const { setChatId, refreshSidebarChats } = useSharedChatContext();
  const currentChatId = useChatId();
  const router = useRouter();

  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressThreadIdRef = useRef<string | null>(null);

  const setMenuOpen = useCallback((threadId: string | null) => {
    setOpenMenuThreadId(threadId);
    if (threadId === null) {
      longPressThreadIdRef.current = null;
    }
  }, []);

  const handleSaveTitle = useCallback(
    async (threadId: string, title: string) => {
      const res = await updateChatTitle(threadId, title);
      if (res.error) {
        logger.error(
          "handleSaveTitle",
          `Error saving title for thread: ${threadId}`,
          res.error.message,
        );
      }
      refreshSidebarChats();
      setEditingThreadId(null);
    },
    [refreshSidebarChats],
  );

  const togglePinThread = useCallback(async (thread: ThreadLink) => {
    logger.log("togglePinThread", `Toggling pin for thread: ${thread.title}`);
    const res = await updateChatPinned(thread.id, !thread.pinned);
    if (res.error) {
      logger.error(
        "togglePinThread",
        `Error toggling pin for thread: ${thread.title}`,
        res.error.message,
      );
    } else {
      refreshSidebarChats();
    }
  }, [refreshSidebarChats]);

  const handleLongPressStart = useCallback(
    (threadId: string) => {
      if (!isMobile) return;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressThreadIdRef.current = threadId;
        setMenuOpen(threadId);
      }, LONG_PRESS_MS);
    },
    [isMobile, setMenuOpen],
  );

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTitleClick = useCallback(
    (threadId: string) => {
      if (editingThreadId === threadId) return;
      if (longPressThreadIdRef.current === threadId) {
        longPressThreadIdRef.current = null;
        return;
      }
      setOpenMobile(false);
      setChatId(threadId);
      router.push(`/chat/${threadId}`);
    },
    [editingThreadId, setOpenMobile, setChatId, router],
  );

  return (
    <SidebarGroupContent className="overflow-visible">
      <SidebarMenu className="h-fit w-full">
        {threads.map((thread) => {
          const isActiveThread = currentChatId === thread.id;
          const isEditing = editingThreadId === thread.id;
          const isMenuOpen = openMenuThreadId === thread.id;

          return (
            <SidebarMenuItem key={thread.id} className="relative">
              <div
                className="font-extralight text-sm w-full rounded hover:bg-background px-3 transition-colors duration-150 group/thread cursor-pointer min-w-0 relative flex text-foreground-secondary items-center"
                onTouchStart={() => handleLongPressStart(thread.id)}
                onTouchEnd={handleLongPressEnd}
                onTouchCancel={handleLongPressEnd}
              >
                <div
                  className="flex-1 min-w-0 overflow-hidden pr-10 py-1"
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  aria-label={isEditing ? undefined : `Open ${thread.title}`}
                  aria-current={isActiveThread ? "page" : undefined}
                  onClick={
                    isEditing
                      ? undefined
                      : (e) => {
                        e.preventDefault();
                        handleTitleClick(thread.id);
                      }
                  }
                  onKeyDown={
                    isEditing
                      ? undefined
                      : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleTitleClick(thread.id);
                        }
                      }
                  }
                >
                  <SidebarChatTitle
                    title={thread.title}
                    editing={isEditing}
                    onSave={(title) => handleSaveTitle(thread.id, title)}
                    onEditingChange={(editing) =>
                      setEditingThreadId(editing ? thread.id : null)
                    }
                  />
                </div>
                {!isMobile && (
                  <div
                    className={`absolute right-0 top-0 bottom-0 flex items-center z-10 pr-1 transition-opacity duration-250 ${isActiveThread || isMenuOpen ? "opacity-100" : "opacity-0 group-hover/thread:opacity-100"}`}
                  >
                    <SidebarThreadActionsMenu
                      thread={thread}
                      open={isMenuOpen}
                      onOpenChange={(open) =>
                        setMenuOpen(open ? thread.id : null)
                      }
                      onEditTitle={() => setEditingThreadId(thread.id)}
                      onTogglePin={() => togglePinThread(thread)}
                    >
                      <span
                        role="button"
                        className="p-1.5 rounded hover:bg-background-tertiary flex items-center justify-center"
                        aria-label="Thread options"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpen(thread.id);
                        }}
                      >
                        <MoreVertical size={18} />
                      </span>
                    </SidebarThreadActionsMenu>
                  </div>
                )}
              </div>
              {isMobile && (
                <div className={`absolute right-0 top-0 bottom-0 flex items-center z-10 pr-1 ${isActiveThread ? "opacity-100" : "opacity-0 group-hover/thread:opacity-100"}`}>
                  <SidebarThreadActionsMenu
                    thread={thread}
                    open={isMenuOpen}
                    onOpenChange={(open) =>
                      setMenuOpen(open ? thread.id : null)
                    }
                    onEditTitle={() => setEditingThreadId(thread.id)}
                    onTogglePin={() => togglePinThread(thread)}

                  >
                    <span
                      role="button"
                      className="p-1.5 rounded hover:bg-background-tertiary flex items-center justify-center touch-manipulation"
                      aria-label="Thread options"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen(thread.id);
                      }}
                    >
                      <MoreVertical size={18} />
                    </span>
                  </SidebarThreadActionsMenu>
                </div>
              )}
              <AnimatePresence>
                {isActiveThread && (
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
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  );
};
