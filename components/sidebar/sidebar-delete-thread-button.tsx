'use client'

import { deleteChat } from "@/data/supabase/chat";
import { ThreadLink } from "@/types";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@heroui/modal'
import { Tooltip } from "@heroui/tooltip";
import { XIcon } from "lucide-react";
import { useCallback } from "react";

export default function SidebarDeleteThreadButton({ thread }: { thread: ThreadLink }) {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()

  const deleteThread = useCallback(() => {
    const handleDeleteThread = async () => {
      const res = await deleteChat(thread.id);
      if (res.ok) {

        /** Refresh sidebar */
        try {
          if (window.refreshSidebar) {
            window.refreshSidebar();
          }
        } catch (error) {
          console.error(error);
        }
        onClose()
      } else {
        console.error(res.error?.message ?? "Unknown error");
      }
    }
    console.log(`Deleting thread: ${thread.title}`);
    handleDeleteThread();

  }, [thread])

  return (
    <>
      <Tooltip
        placement="bottom"
        content={"Delete Thread"}
        size="sm"
        offset={1}
        closeDelay={50}
      >
        <div
          className="hover:bg-background-tertiary w-full h-full flex items-center justify-center rounded px-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen()
          }}
        >
          <XIcon size={18} />
        </div>
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
  )
}