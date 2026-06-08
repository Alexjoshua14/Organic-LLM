"use client";

import { useCallback, useEffect } from "react";
import { useDisclosure } from "@heroui/modal";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, ChevronDown, Pin, PinOff, Trash2 } from "lucide-react";

import { useChatSettingsExpand } from "./chat-settings-expand-context";

import { DeleteThreadConfirmModal } from "@/components/sidebar/delete-thread-confirm-modal";
import { caption, glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import {
  deleteChat,
  updateChatArchived,
  updateChatPinned,
  type ChatThreadSettingsRow,
} from "@/data/supabase/chat";
import { formatDate } from "@/lib/format/stringFormatting";
import { createLogger } from "@/lib/logger";
import { getThreadFeatureCaption } from "@/lib/chat/thread-feature-caption";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { cn } from "@/lib/utils";

const logger = createLogger("components/settings/chats/settings-chat-title-row.tsx");

const ARCADIA_TITLE_CLASS =
  "bg-linear-to-tr from-emerald-600/90 via-emerald-700/80 to-foreground bg-clip-text text-transparent";

type SettingsChatTitleRowProps = {
  thread: ChatThreadSettingsRow;
  onThreadUpdated: () => void;
};

export function SettingsChatTitleRow({ thread, onThreadUpdated }: SettingsChatTitleRowProps) {
  const { expandedId, setExpandedId, toggleExpanded } = useChatSettingsExpand();
  const isExpanded = expandedId === thread.id;
  const { refreshSidebarChats } = useSharedChatContext();
  const pathname = usePathname();
  const router = useRouter();
  const {
    isOpen: deleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
    onOpenChange: onDeleteOpenChange,
  } = useDisclosure();

  const displayTitle =
    thread.title != null && String(thread.title).trim() !== ""
      ? String(thread.title)
      : "Untitled chat";
  const featureCaption = getThreadFeatureCaption(thread.feature);
  const isArcadia = thread.feature === "arcadia";
  const isArchived = thread.archived === true;

  useEffect(() => {
    if (!isExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;

      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      setExpandedId(null);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [isExpanded, setExpandedId]);

  const handleExpand = useCallback(() => {
    setExpandedId(thread.id);
  }, [setExpandedId, thread.id]);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpanded(thread.id);
    },
    [toggleExpanded, thread.id]
  );

  const runAfterMutate = useCallback(async () => {
    refreshSidebarChats();
    onThreadUpdated();
  }, [refreshSidebarChats, onThreadUpdated]);

  const handlePin = useCallback(async () => {
    const res = await updateChatPinned(thread.id, !thread.pinned);

    if (res.error) {
      logger.error("handlePin", res.error.message);
    } else {
      await runAfterMutate();
    }
  }, [thread.id, thread.pinned, runAfterMutate]);

  const handleArchive = useCallback(async () => {
    const res = await updateChatArchived(thread.id, !isArchived);

    if (res.error) {
      logger.error("handleArchive", res.error.message);
    } else {
      await runAfterMutate();
    }
  }, [thread.id, isArchived, runAfterMutate]);

  const handleConfirmDelete = useCallback(async () => {
    const res = await deleteChat(thread.id);

    if (res.ok) {
      await runAfterMutate();
      onDeleteClose();
      setExpandedId(null);
      if (pathname === thread.href || pathname === `/chat/${thread.id}`) {
        router.push("/");
      }
    } else {
      logger.error("handleConfirmDelete", res.error?.message ?? "Unknown error");
    }
  }, [thread.id, runAfterMutate, onDeleteClose, setExpandedId, pathname, router]);

  return (
    <>
      <motion.div
        className={cn(
          glass(),
          "group relative rounded-2xl border border-border/45 dark:border-white/10 transition-colors",
          "hover:border-accent/20",
          isExpanded && "ring-1 ring-accent/15"
        )}
        layout
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="relative px-4 py-3">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse chat details" : "Expand chat details"}
            className={cn(
              "absolute right-2 top-3 z-10 rounded-md p-1 text-muted-foreground transition-opacity",
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              isExpanded && "opacity-100"
            )}
            onClick={handleChevronClick}
          >
            <ChevronDown
              className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180")}
            />
          </button>

          {!isExpanded ? (
            <div
              aria-label={`${displayTitle}, ${featureCaption}`}
              className="cursor-pointer select-none pr-8"
              role="button"
              tabIndex={0}
              onClick={handleExpand}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleExpand();
                }
              }}
            >
              <div
                className={cn(
                  "font-semibold text-sm truncate text-foreground",
                  isArcadia && ARCADIA_TITLE_CLASS
                )}
              >
                {displayTitle}
              </div>
              <p className={caption({ className: "truncate mt-0.5" })}>{featureCaption}</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <motion.div
                key="expanded"
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden pr-8"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="space-y-3 pt-1">
                  <div>
                    <h3
                      className={cn(
                        "font-semibold text-sm break-words text-foreground",
                        isArcadia && ARCADIA_TITLE_CLASS
                      )}
                    >
                      {displayTitle}
                    </h3>
                    <p className={caption({ className: "mt-0.5" })}>{featureCaption}</p>
                  </div>
                  <div
                    className={cn(
                      "max-h-[max(30vh,15rem)] overflow-y-auto rounded-lg border border-border/25 bg-background/30 px-3 py-2 text-sm text-foreground/90"
                    )}
                  >
                    {thread.conversationSummary?.trim()
                      ? thread.conversationSummary
                      : "No conversation summary yet."}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={thread.pinned ? "Unpin thread" : "Pin thread"}
                          className="size-8"
                          size="icon"
                          variant="outline"
                          onClick={() => void handlePin()}
                        >
                          {thread.pinned ? (
                            <PinOff className="size-4" />
                          ) : (
                            <Pin className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {thread.pinned ? "Unpin thread" : "Pin thread"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={isArchived ? "Unarchive thread" : "Archive thread"}
                          className="size-8"
                          size="icon"
                          variant="outline"
                          onClick={() => void handleArchive()}
                        >
                          {isArchived ? (
                            <ArchiveRestore className="size-4" />
                          ) : (
                            <Archive className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isArchived ? "Unarchive thread" : "Archive thread"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label="Delete thread"
                          className="size-8 text-destructive hover:text-destructive"
                          size="icon"
                          variant="outline"
                          onClick={onDeleteOpen}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete thread</TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last updated {formatDate(thread.updated_at)} • Created{" "}
                    {formatDate(thread.created_at)}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <DeleteThreadConfirmModal
        isOpen={deleteOpen}
        thread={{ id: thread.id, title: displayTitle }}
        onConfirmDelete={handleConfirmDelete}
        onOpenChange={onDeleteOpenChange}
      />
    </>
  );
}
