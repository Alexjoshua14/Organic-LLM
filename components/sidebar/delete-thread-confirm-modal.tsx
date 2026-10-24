"use client";

import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";

import { ThreadLink } from "@/types";

export type DeleteThreadConfirmModalProps = {
  thread: Pick<ThreadLink, "id" | "title">;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void | Promise<void>;
};

export function DeleteThreadConfirmModal({
  thread,
  isOpen,
  onOpenChange,
  onConfirmDelete,
}: DeleteThreadConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Delete thread</ModalHeader>
        <ModalBody>
          Are you sure you want to delete &quot;{thread.title}&quot;? This cannot be undone.
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button color="danger" onPress={() => void onConfirmDelete()}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
