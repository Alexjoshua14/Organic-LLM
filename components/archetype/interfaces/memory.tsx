import React, { useCallback, useState } from "react";
import { Settings, Trash, X } from "lucide-react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { AnimatePresence, motion } from "framer-motion";

import { Separator } from "@/components/third-party/ui/separator";
import { MemoryItemType } from "@/lib/schemas/memory";
import { Button } from "@/components/third-party/ui/button";
import { useArchetypeContext } from "@/lib/context/archetype-context";
import { createLogger } from "@/lib/logger";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { Spinner } from "@/components/third-party/ui/spinner";
import { dateStringCompare } from "@/lib/utils";
import { formatDate } from "@/lib/format/stringFormatting";

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
  }, [setRequestConfirmDelete]);

  const handleConfirmedMemoryDeletion = useCallback(() => {
    logger.log("handleConfirmedMemoryDeletion", "Starting memory deletion process");
    setIsDeleting(true);
    // Safeguards
    try {
      if (!requestConfirmDelete) {
        logger.log("handleConfirmedMemoryDeletion", "Request to confirm delete was not true");

        return;
      }

      if (!archetypeData || archetypeData.kind !== "memory") {
        logger.log(
          "handleConfirmedMemoryDeletion",
          "archetypeData missing or not of kind 'memory'"
        );

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
  }, [archetypeData, setArchetypeData, memory.id, requestConfirmDelete]);

  return (
    <div className="flex gap-2 items-center">
      <span className="flex-1 text-sm text-foreground line-clamp-2 text-ellipsis">
        {memory.memory}
      </span>
      <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-150 h-full flex items-center justify-center">
        <Button className="cursor-pointer" size="icon" variant="glass" onClick={onOpen}>
          <Settings color="var(--secondary-foreground)" size={18} />
        </Button>
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
          <ModalContent>
            {() => (
              <>
                <ModalHeader>
                  <h1>Edit Memory</h1>
                </ModalHeader>
                <ModalBody className="flex flex-col justify-between max-h-[75dvh]">
                  <div className="flex-1 w-full font-medium overflow-y-auto">{memory.memory}</div>
                  <Separator />
                  <div
                    className={[
                      "w-fit",
                      "min-h-fit max-h-[10dvh]",
                      "grid grid-cols-[1fr_auto]",
                      "space-x-2 space-y-1",
                      "justify-end items-end",
                      "[&>h3]:m-0 [&>p]:m-0",
                      "*:px-2 *:py-1",
                      "text-xs",
                      "[&>h3]:leading-none [&>p]:leading-none",
                      "text-secondary-foreground",
                    ].join(" ")}
                  >
                    {dateStringCompare(memory.updatedAt, memory.createdAt) > 0 && (
                      <>
                        <h3 className="text-xs">Last Updated:</h3>
                        <p className="text-xs italic">
                          {memory.updatedAt ? formatDate(memory.updatedAt) : "unknown"}
                        </p>
                      </>
                    )}
                    <h3 className="text-xs">Created:</h3>
                    <p className="text-xs italic">
                      {memory.createdAt ? formatDate(memory.createdAt) : "unknown"}
                    </p>
                  </div>
                </ModalBody>
                <ModalFooter>
                  {requestConfirmDelete ? (
                    <div className="flex gap-4 items-center">
                      <AnimatePresence>
                        <motion.div
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: "100%" }}
                          initial={{ opacity: 0, y: "100%" }}
                          transition={{ duration: 0.18 }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                className="w-28 flex items-center justify-center"
                                color="var(--destructive)"
                                disabled={isDeleting}
                                variant="destructive"
                                onClick={handleConfirmedMemoryDeletion}
                              >
                                {isDeleting ? <Spinner /> : "Confirm Delete"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isDeleting ? "Deleting memory..." : "Delete memory"}
                            </TooltipContent>
                          </Tooltip>
                        </motion.div>
                      </AnimatePresence>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="glass" onClick={() => setRequestConfirmDelete(false)}>
                            <X color="var(--secondary-foreground)" size={18} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="glass" onClick={handleDeleteMemory}>
                            <Trash color="var(--destructive)" size={18} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete memory</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
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
            <Separator className="w-full bg-foreground/15 my-2" orientation="horizontal" />
          )}
        </div>
      ))}
    </div>
  );
};

export default MemoryList;
