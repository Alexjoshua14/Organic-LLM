"use client";

import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Pencil, Pin, PinOff, Sparkles, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";
import { ThreadLink } from "@/types";
import { deleteChat } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";

const logger = createLogger("components/sidebar/sidebar-thread-actions-menu.tsx");

type SidebarThreadActionsMenuProps = {
  thread: ThreadLink;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTitle: () => void;
  onTogglePin: () => void;
  children: React.ReactNode;
};

export function SidebarThreadActionsMenu({
  thread,
  open,
  onOpenChange,
  onEditTitle,
  onTogglePin,
  children,
}: SidebarThreadActionsMenuProps) {
  const { isOpen, onOpen, onClose, onOpenChange: onModalOpenChange } = useDisclosure();
  const pathname = usePathname();
  const router = useRouter();
  const { refreshSidebarChats } = useSharedChatContext();

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
    onOpenChange(false);
    const threadId = thread.id;

    fetch(`/api/chat/${threadId}/generate-title`, { method: "POST" })
      .then((res) => {
        if (res.ok) {
          refreshSidebarChats();
        } else {
          logger.error("handleGenerateTitle", `Failed to generate title: ${res.status}`);
        }
      })
      .catch((err) => {
        logger.error("handleGenerateTitle", err);
      });
  }, [thread.id, onOpenChange, refreshSidebarChats]);

  const deleteThread = useCallback(() => {
    const handleDeleteThread = async () => {
      const threadID = thread.id;
      const res = await deleteChat(threadID);

      if (res.ok) {
        refreshSidebarChats();
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
  }, [thread, pathname, router, refreshSidebarChats, onClose]);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={handleEditTitle}>
            <Pencil className="size-4" />
            Edit title
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleGenerateTitle}>
            <Sparkles className="size-4" />
            {thread.hasNoTitle === true ? "Generate title (AI)" : "Regenerate title (AI)"}
          </DropdownMenuItem>
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
      <Modal isOpen={isOpen} onOpenChange={onModalOpenChange}>
        <ModalContent>
          <ModalHeader>Delete thread</ModalHeader>
          <ModalBody>
            Are you sure you want to delete &quot;{thread.title}&quot;? This cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={deleteThread}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
