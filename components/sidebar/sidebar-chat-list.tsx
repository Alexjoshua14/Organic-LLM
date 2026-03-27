"use client";

import { FC, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import {
  SidebarGroupContent,
  SidebarMenu,
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
import { cn } from "@/lib/utils";

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
          res.error.message
        );
      }
      refreshSidebarChats();
      setEditingThreadId(null);
    },
    [refreshSidebarChats]
  );

  const togglePinThread = useCallback(
    async (thread: ThreadLink) => {
      logger.log("togglePinThread", `Toggling pin for thread: ${thread.title}`);
      const res = await updateChatPinned(thread.id, !thread.pinned);

      if (res.error) {
        logger.error(
          "togglePinThread",
          `Error toggling pin for thread: ${thread.title}`,
          res.error.message
        );
      } else {
        refreshSidebarChats();
      }
    },
    [refreshSidebarChats]
  );

  const handleLongPressStart = useCallback(
    (threadId: string) => {
      if (!isMobile) return;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressThreadIdRef.current = threadId;
        setMenuOpen(threadId);
      }, LONG_PRESS_MS);
    },
    [isMobile, setMenuOpen]
  );

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTitleClick = useCallback(
    (thread: ThreadLink) => {
      if (editingThreadId === thread.id) return;
      if (longPressThreadIdRef.current === thread.id) {
        longPressThreadIdRef.current = null;

        return;
      }
      setOpenMobile(false);
      setChatId(thread.id);
      router.push(thread.href ?? `/chat/${thread.id}`);
    },
    [editingThreadId, setOpenMobile, setChatId, router]
  );

  return (
    <SidebarGroupContent className="overflow-visible">
      <SidebarMenu className="h-fit w-full">
        {threads.map((thread) => {
          const isActiveThread = currentChatId === thread.id;
          const isEditing = editingThreadId === thread.id;
          const isMenuOpen = openMenuThreadId === thread.id;
          const isArcadia = thread.feature === "arcadia";

          return (
            <SidebarMenuItem key={thread.id} className="relative">
              <div
                className={cn(
                  "font-extralight text-sm w-full rounded px-3 transition-colors duration-150 group/thread cursor-pointer min-w-0 relative flex items-center",
                  isArcadia
                    ? cn(
                        "border border-transparent",
                        "hover:bg-amber-950/10 dark:hover:bg-amber-950/20",
                        "hover:border-amber-900/10 dark:hover:border-amber-200/10",
                        "hover:backdrop-saturate-150 hover:backdrop-blur-2xl",
                        "hover:backdrop-brightness-110 dark:hover:backdrop-brightness-200",
                        isActiveThread &&
                          cn(
                            "bg-amber-950/10 dark:bg-amber-950/20",
                            "border-amber-900/10 dark:border-amber-200/10",
                            "backdrop-saturate-150 backdrop-blur-2xl",
                            "backdrop-brightness-110 dark:backdrop-brightness-200"
                          )
                      )
                    : "hover:bg-background",
                  isArcadia ? "text-foreground" : "text-foreground-secondary"
                )}
                onTouchCancel={handleLongPressEnd}
                onTouchEnd={handleLongPressEnd}
                onTouchStart={() => handleLongPressStart(thread.id)}
              >
                <div
                  aria-current={isActiveThread ? "page" : undefined}
                  aria-label={isEditing ? undefined : `Open ${thread.title}`}
                  className="flex-1 min-w-0 overflow-hidden pr-10 py-1"
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  onClick={
                    isEditing
                      ? undefined
                      : (e) => {
                          e.preventDefault();
                          handleTitleClick(thread);
                        }
                  }
                  onKeyDown={
                    isEditing
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleTitleClick(thread);
                          }
                        }
                  }
                >
                  <SidebarChatTitle
                    editing={isEditing}
                    title={thread.title}
                    onEditingChange={(editing) => setEditingThreadId(editing ? thread.id : null)}
                    onSave={(title) => handleSaveTitle(thread.id, title)}
                    className={
                      isArcadia
                        ? "bg-linear-to-tr from-emerald-600/85 via-foreground-secondary to-foreground-secondary bg-clip-text text-transparent"
                        : undefined
                    }
                  />
                </div>
                {!isMobile && (
                  <div
                    className={`absolute right-0 top-0 bottom-0 flex items-center z-10 pr-1 transition-opacity duration-250 ${isActiveThread || isMenuOpen ? "opacity-100" : "opacity-0 group-hover/thread:opacity-100"}`}
                  >
                    <SidebarThreadActionsMenu
                      open={isMenuOpen}
                      thread={thread}
                      onEditTitle={() => setEditingThreadId(thread.id)}
                      onOpenChange={(open) => setMenuOpen(open ? thread.id : null)}
                      onTogglePin={() => togglePinThread(thread)}
                    >
                      <span
                        aria-label="Thread options"
                        className="p-1.5 rounded hover:bg-background-tertiary flex items-center justify-center"
                        role="button"
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
                <div
                  className={`absolute right-0 top-0 bottom-0 flex items-center z-10 pr-1 ${isActiveThread ? "opacity-100" : "opacity-0 group-hover/thread:opacity-100"}`}
                >
                  <SidebarThreadActionsMenu
                    open={isMenuOpen}
                    thread={thread}
                    onEditTitle={() => setEditingThreadId(thread.id)}
                    onOpenChange={(open) => setMenuOpen(open ? thread.id : null)}
                    onTogglePin={() => togglePinThread(thread)}
                  >
                    <span
                      aria-label="Thread options"
                      className="p-1.5 rounded hover:bg-background-tertiary flex items-center justify-center touch-manipulation"
                      role="button"
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
                {isActiveThread && !isArcadia && (
                  <motion.div
                    key={thread.id}
                    animate={{ opacity: 1 }}
                    aria-hidden="true"
                    className="absolute top-0 right-0 w-full h-full z-20 pointer-events-none rounded-lg backdrop-brightness-110 dark:backdrop-brightness-150 border"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
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
