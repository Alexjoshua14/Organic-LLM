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
import { Tooltip } from "@heroui/tooltip";
import { XIcon } from "lucide-react";
import { useCallback } from "react";

import { ThreadLink } from "@/types";
import { deleteChat } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { useRouter, usePathname } from "next/navigation";

const logger = createLogger(
  "components/sidebar/sidebar-delete-thread-button.tsx",
);

export default function SidebarDeleteThreadButton({
  thread,
}: {
  thread: ThreadLink;
}) {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const pathname = usePathname()
  const router = useRouter()

  const deleteThread = useCallback(() => {
    const handleDeleteThread = async () => {
      const threadID = thread.id;
      const res = await deleteChat(threadID);

      if (res.ok) {
        /** Refresh sidebar */
        try {
          if (window.refreshSidebar) {
            window.refreshSidebar();
          }
        } catch (error) {
          logger.error(
            "handleDeleteThread",
            "Error refreshing sidebar:",
            error,
          );
        }
        onClose();
        if (pathname === `/chat/${threadID}`)
          router.push("/");
        else {
          logger.log("handleDeleteThread", `No redirect needed for path: ${pathname} !== /chat/${threadID}`);
        }
      } else {
        logger.error(
          "handleDeleteThread",
          res.error?.message ?? "Unknown error",
        );
      }
    };

    logger.log("deleteThread", `Deleting thread: ${thread.title}`);
    handleDeleteThread();
  }, [thread, pathname, router]);

  return (
    <>
      <Tooltip
        closeDelay={50}
        content={"Delete Thread"}
        offset={1}
        placement="bottom"
        size="sm"
      >
        <button
          className="hover:bg-background-tertiary w-full h-full flex items-center justify-center rounded px-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen();
          }}
        >
          <XIcon size={18} />
        </button>
      </Tooltip>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalHeader>Delete Thread: {thread.title}</ModalHeader>
          <ModalBody>Are you sure you want to delete this thread?</ModalBody>
          <ModalFooter>
            <Button onPress={deleteThread}>Delete</Button>
            <Button onPress={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
