import React, { useCallback, useState } from "react";
import { Separator } from "@/components/third-party/ui/separator";
import { MemoryItemType } from "@/lib/schemas/memory";
import { Settings, Settings2, Trash, Trash2, X } from "lucide-react";
import { Button } from "@/components/third-party/ui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/modal";
import { Input } from "@/components/third-party/ui/input";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { createLogger } from "@/lib/logger";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { Spinner } from "@/components/third-party/ui/spinner";
import { sleep } from "@/lib/utils";

const logger = createLogger("components/archetype/interfaces/memory.tsx");


type MemoryListProps = {
  memories: MemoryItemType[];
};

type MemoryItemProps = {
  memory: MemoryItemType;
};
const MemoryItem: React.FC<MemoryItemProps> = ({ memory }) => {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

  const { archetypeData, setArchetypeData } = useArchetypeContext();

  // TODO: Refactor into custom hook
  const [requestConfirmDelete, setRequestConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteMemory = useCallback(() => {
    setRequestConfirmDelete(true);
  }, [setRequestConfirmDelete])

  const handleConfirmedMemoryDeletion = useCallback(() => {
    logger.log("handleConfirmedMemoryDeletion", "Starting memory deletion process");
    setIsDeleting(true);
    // Safeguards
    try {
      if (!requestConfirmDelete) {
        logger.log("handleConfirmedMemoryDeletion", "Request to confirm delete was not true")
        return;
      }

      if (!archetypeData || archetypeData.kind !== "memory") {
        logger.log("handleConfirmedMemoryDeletion", "archetypeData missing or not of kind 'memory'")
        return;
      }

      const memoryId = memory.id;

      // TODO: Implement actual functionality
      const newMemories = archetypeData.memories.filter((m) => m.id !== memoryId);
      const res = setArchetypeData({ ...archetypeData, memories: newMemories });
      if (!res) {
        throw new Error("Archetype update failed");
      }
      logger.log("handleConfirmedMemoryDeletion", "Memory deleted successfully");
      onClose();
    } catch (error) {
      logger.error("handleConfirmedMemoryDeletion", "Error deleting memory", error);
      return;
    } finally {
      setIsDeleting(false);
    }
  }, [archetypeData, setArchetypeData, memory.id, requestConfirmDelete])

  return (
    <div className="flex gap-2 items-center">
      <span className="flex-1 text-sm text-foreground line-clamp-2 text-ellipsis">{memory.memory}</span>
      <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-150 h-full flex items-center justify-center">
        <Button variant="glass" size="icon" className="cursor-pointer" onClick={onOpen}>
          <Settings size={18} color="var(--secondary-foreground)" />
        </Button>
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>
                  Edit Memory:
                </ModalHeader>
                <ModalBody>
                  {memory.memory}
                </ModalBody>
                <ModalFooter>
                  {
                    requestConfirmDelete ? (
                      <div className="flex gap-2 items-center">
                        <span>Confirm Delete:</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              color="var(--destructive)"
                              onClick={handleConfirmedMemoryDeletion}
                              disabled={isDeleting}
                              className="w-24 flex items-center justify-center"
                            >
                              {isDeleting ? <Spinner /> : "Delete"}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isDeleting ? "Deleting memory..." : "Delete memory"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="glass"
                              onClick={() => setRequestConfirmDelete(false)}
                            >
                              <X size={18} color="var(--secondary-foreground)" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Cancel
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="glass" onClick={handleDeleteMemory}>
                              <Trash size={18} color="var(--destructive)" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Delete memory
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )
                  }
                </ModalFooter>
              </>
            )}

          </ModalContent>
        </Modal>
      </div>
    </div>
  );
};

const MemoryList: React.FC<MemoryListProps> = ({ memories }) => {
  if (!memories || memories.length === 0) return <div>No items to display.</div>;

  return (
    <div className="flex flex-col">
      {memories.map((memory, idx) => (
        <div key={idx} className="group">
          <MemoryItem memory={memory} />
          {idx < memories.length - 1 && (
            <Separator orientation="horizontal" className="w-full bg-foreground/15 my-2" />
          )}
        </div>
      ))}
    </div>
  );
};

export default MemoryList;
