"use client";

import { FC, useCallback, useId, useRef, useState } from "react";
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
import { SessionGlyph } from "@/components/sidebar/session-glyph";
import { SessionSignalTray } from "@/components/sidebar/session-signal-tray";
import { useThreadTitleGeneration } from "@/hooks/use-thread-title-generation";
import { getSessionExperience, SESSION_EXPERIENCES } from "@/lib/sidebar/session-experience";
import {
  describeSessionSignal,
  IDLE_SIGNAL,
  type SessionSignal,
} from "@/lib/sidebar/session-signal";
import { cn } from "@/lib/utils";

const logger = createLogger("components/sidebar/sidebar-chat-list.tsx");

const LONG_PRESS_MS = 500;

type SidebarChatListProps = {
  threads: ThreadLink[];
  /** Per-thread signal from `SidebarChats`. Threads without one are idle. */
  signals?: ReadonlyMap<string, SessionSignal>;
  /**
   * The thread on screen, when the parent resolved it (covers query-string routes such as
   * rabbit holes). Omitted → the path-slug id from `useChatId`.
   */
  activeThreadId?: string | null;
};

export const SidebarChatList: FC<SidebarChatListProps> = ({ threads, signals, activeThreadId }) => {
  const { setOpenMobile, isMobile } = useSidebar();
  const { setChatId, refreshSidebarChats } = useSharedChatContext();
  const pathChatId = useChatId();
  const currentChatId = activeThreadId !== undefined ? activeThreadId : pathChatId;
  const router = useRouter();
  const descriptionIdPrefix = useId();
  const { titleGeneration, generateTitle, announcement } =
    useThreadTitleGeneration(refreshSidebarChats);

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
          const experience = getSessionExperience(thread.feature);
          const titleStatus = titleGeneration.get(thread.id);
          // Local title work outranks server signals while it lasts: it answers the user's click.
          const signal: SessionSignal =
            titleStatus?.phase === "pending"
              ? { kind: "working", step: null, label: "Generating title" }
              : titleStatus?.phase === "failed"
                ? { kind: "notice", text: titleStatus.message }
                : (signals?.get(thread.id) ?? IDLE_SIGNAL);
          const isNew = signal.kind === "new";
          const descriptionId = `${descriptionIdPrefix}-${thread.id}`;

          return (
            <SidebarMenuItem
              key={thread.id}
              className="relative"
              data-session-signal={signal.kind}
              data-sidebar-thread={thread.id}
            >
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
                  aria-describedby={isEditing ? undefined : descriptionId}
                  aria-label={isEditing ? undefined : `Open ${thread.title}`}
                  className="flex-1 min-w-0 overflow-hidden pr-10 py-1"
                  data-sidebar-thread-open
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
                  <div className="flex min-w-0 items-center gap-2">
                    <SessionGlyph
                      emphasized={isActiveThread}
                      experience={experience}
                      signal={signal}
                    />
                    <SidebarChatTitle
                      editing={isEditing}
                      title={thread.title}
                      onEditingChange={(editing) => setEditingThreadId(editing ? thread.id : null)}
                      onSave={(title) => handleSaveTitle(thread.id, title)}
                      className={cn(
                        isArcadia
                          ? "bg-linear-to-tr from-emerald-600/85 via-foreground-secondary to-foreground-secondary bg-clip-text text-transparent"
                          : isNew && "text-foreground font-light",
                        // The title being replaced steps back while its successor is written.
                        titleStatus?.phase === "pending" && "opacity-55"
                      )}
                    />
                  </div>
                  {/* Indented past the glyph (14px + 8px gap) so the status reads as the title's. */}
                  <SessionSignalTray className="pl-5.5" signal={signal} />
                  <span className="sr-only" id={descriptionId}>
                    {describeSessionSignal(SESSION_EXPERIENCES[experience].label, signal)}
                  </span>
                </div>
                {!isMobile && (
                  <div
                    className={`absolute right-0 top-0 bottom-0 flex items-center z-10 pr-1 transition-opacity duration-250 ${isActiveThread || isMenuOpen ? "opacity-100" : "opacity-0 group-hover/thread:opacity-100"}`}
                  >
                    <SidebarThreadActionsMenu
                      open={isMenuOpen}
                      thread={thread}
                      onEditTitle={() => setEditingThreadId(thread.id)}
                      onGenerateTitle={() => void generateTitle(thread)}
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
                    onGenerateTitle={() => void generateTitle(thread)}
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
      <div aria-live="polite" className="sr-only" role="status">
        {announcement}
      </div>
    </SidebarGroupContent>
  );
};
