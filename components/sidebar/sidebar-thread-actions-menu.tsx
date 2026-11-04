"use client";

import { useDisclosure } from "@heroui/modal";
import { Copy, Pencil, Pin, PinOff, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cloneElement, useCallback, useState, type ReactElement, type HTMLAttributes } from "react";
import { useRouter, usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";
import { DeleteThreadConfirmModal } from "@/components/sidebar/delete-thread-confirm-modal";
import { ThreadLink } from "@/types";
import { deleteChat } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { useTitleRegenSession } from "@/lib/chat/title-regen-store";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { copyThreadToClipboard } from "@/lib/clipboard/thread-clipboard";

const logger = createLogger("components/sidebar/sidebar-thread-actions-menu.tsx");

type SidebarThreadActionsMenuProps = {
  thread: ThreadLink;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTitle: () => void;
  /** Starts AI title regeneration; the row owns the progress feedback. */
  onGenerateTitle: () => void;
  onTogglePin: () => void;
  children: React.ReactNode;
};

export function SidebarThreadActionsMenu({
  thread,
  open,
  onOpenChange,
  onEditTitle,
  onGenerateTitle,
  onTogglePin,
  children,
}: SidebarThreadActionsMenuProps) {
  const { isOpen, onOpen, onClose, onOpenChange: onModalOpenChange } = useDisclosure();
  const pathname = usePathname();
  const router = useRouter();
  const { removeSidebarChat, isTitleRegenerating } = useSharedChatContext();
  const titleOwnedByExperience = thread.feature === "rabbit_hole";
  const titleRegenInFlight = useTitleRegenSession(thread.id) != null;

  const handleEditTitle = useCallback(() => {
    onOpenChange(false);
    onEditTitle();
  }, [onOpenChange, onEditTitle]);

  const handleTogglePin = useCallback(() => {
    onOpenChange(false);
    onTogglePin();
  }, [onOpenChange, onTogglePin]);

  const handleDeleteClick = useCallback(() => {
    onOpenChange(false);
    onOpen();
  }, [onOpenChange, onOpen]);

  const handleGenerateTitle = useCallback(() => {
    if (isTitleRegenerating(thread.id)) return;

    onOpenChange(false);
    onGenerateTitle();
  }, [thread.id, isTitleRegenerating, onOpenChange, onGenerateTitle]);

  const deleteThread = useCallback(() => {
    const handleDeleteThread = async () => {
      const threadID = thread.id;
      const res = await deleteChat(threadID);

      if (res.ok) {
        removeSidebarChat(threadID);
        onClose();
        if (pathname === `/chat/${threadID}`) {
          router.push("/");
        }
      } else {
        logger.error("handleDeleteThread", res.error?.message ?? "Unknown error");
      }
    };

    logger.log("deleteThread", `Deleting thread: ${thread.title}`);
    handleDeleteThread();
  }, [thread, pathname, router, removeSidebarChat, onClose]);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem
            onSelect={() => {
              void copyThreadToClipboard(thread.id).then(({ copied, saved }) => {
                if (copied && saved)
                  toast.success("Thread copied and saved to your thread clipboard");
                else if (copied)
                  toast.success("Thread copied", {
                    description: "Saved clipboard is currently unavailable.",
                  });
                else if (saved)
                  toast.success("Saved to your thread clipboard", {
                    description: "Native clipboard access was unavailable.",
                  });
                else toast.error("Couldn’t copy thread");
              });
            }}
          >
            <Copy className="size-4" />
            Copy thread
          </DropdownMenuItem>
          {/* A rabbit hole's title comes from the rabbit hole itself (see GET /api/chats). */}
          {!titleOwnedByExperience && (
            <>
              <DropdownMenuItem onSelect={handleEditTitle}>
                <Pencil className="size-4" />
                Edit title
              </DropdownMenuItem>
              <DropdownMenuItem disabled={titleRegenInFlight} onSelect={handleGenerateTitle}>
                <Sparkles className="size-4" />
                {titleRegenInFlight
                  ? "Generating title…"
                  : thread.hasNoTitle === true
                    ? "Generate title (AI)"
                    : "Regenerate title (AI)"}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={handleTogglePin}>
            {thread.pinned ? (
              <>
                <PinOff className="size-4" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="size-4" />
                Pin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger focus:text-danger" onSelect={handleDeleteClick}>
            <Trash2 className="size-4" />
            Delete thread
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteThreadConfirmModal
        isOpen={isOpen}
        thread={{ id: thread.id, title: thread.title }}
        onConfirmDelete={deleteThread}
        onOpenChange={onModalOpenChange}
      />
    </>
  );
}

type LazySidebarThreadActionsMenuProps = Omit<SidebarThreadActionsMenuProps, "children"> & {
  children: ReactElement<HTMLAttributes<HTMLElement>>;
};

/**
 * Mounts the menu the first time its trigger is pointed at, focused, or opened, then
 * keeps it mounted so the delete modal survives the menu closing. Until then each row
 * renders only the trigger, not a dropdown root, modal state, and router hooks.
 */
export function LazySidebarThreadActionsMenu(props: LazySidebarThreadActionsMenuProps) {
  const [armed, setArmed] = useState(false);

  if (armed || props.open) return <SidebarThreadActionsMenu {...props} />;

  const arm = () => setArmed(true);

  return cloneElement(props.children, { onPointerEnter: arm, onFocus: arm });
}
