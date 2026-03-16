"use client";

import { MemoryItem } from "mem0ai/oss";
import { useCallback, useMemo } from "react";

import { glass } from "../design-system/primitives";

import {
  Item,
  ItemContent,
  ItemTitle,
  ItemActions,
  ItemFooter,
} from "@/components/third-party/ui/item";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";
import { deleteMemoryForCurrentUser } from "@/lib/memory/operations";

interface MemoryCardProps {
  memory: MemoryItem;
}

const logger = createLogger("components/memory/memoryCard.tsx");

export const MemoryCard = ({ memory }: MemoryCardProps) => {
  const handleDeleteMemory = useCallback(async () => {
    logger.log("MemoryCard", "Deleting memory", memory.id);

    const result = await deleteMemoryForCurrentUser(memory.id);

    if (result.error) {
      logger.error("MemoryCard", "Error deleting memory", result.error);

      return;
    }
    if (result.data !== true) {
      logger.error("MemoryCard", "Error deleting memory");

      return;
    }
    logger.log("MemoryCard", "Memory deleted successfully");
  }, [memory]);

  const dateString = useMemo(() => {
    const date = new Date(memory.createdAt ?? "");

    const timeString = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return `${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} • ${timeString}`;
  }, [memory.createdAt]);

  return (
    <Item className={cn("p-4", glass())}>
      <ItemContent>
        <ItemTitle>{memory.memory}</ItemTitle>
        <ItemFooter className="text-xs text-muted-foreground">{dateString}</ItemFooter>
      </ItemContent>
      <ItemActions>
        <Button
          className="cursor-pointer"
          size="sm"
          variant="destructive"
          onClick={handleDeleteMemory}
        >
          Delete
        </Button>
      </ItemActions>
    </Item>
  );
};
