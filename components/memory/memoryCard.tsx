'use client'

import { MemoryItem } from "mem0ai/oss"
import { Item, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemFooter } from "@/components/third-party/ui/item"
import { Button } from "@/components/third-party/ui/button"
import { useCallback, useMemo } from "react"
import { glass } from "../design-system/primitives"
import { cn } from "@/lib/utils"
import { createLogger } from "@/lib/logger";
import { deleteMemory } from "@/lib/memory/operations";

interface MemoryCardProps {
  memory: MemoryItem
}

const logger = createLogger("components/memory/memoryCard.tsx");

export const MemoryCard = ({ memory }: MemoryCardProps) => {

  const handleDeleteMemory = useCallback(async () => {
    logger.log("MemoryCard", "Deleting memory", memory.id);

    try {
      const res = await deleteMemory(memory.id);
      if (!res) {
        logger.error("MemoryCard", "Error deleting memory");
        return;
      }
    } catch (error) {
      logger.error("MemoryCard", "Error deleting memory", error);
      return;
    }
    logger.log("MemoryCard", "Memory deleted successfully");

  }, [memory]);

  const dateString = useMemo(() => {
    const date = new Date(memory.createdAt ?? "");

    const timeString = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    return `${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} • ${timeString}`;
  }, [memory.createdAt]);


  return (
    <Item className={cn("p-4", glass())}>
      <ItemContent>
        <ItemTitle>
          {memory.memory}
        </ItemTitle>
        <ItemFooter className="text-xs text-muted-foreground">
          {dateString}
        </ItemFooter>
      </ItemContent>
      <ItemActions>
        <Button variant="destructive" size="sm" onClick={handleDeleteMemory} className="cursor-pointer">
          Delete
        </Button>
      </ItemActions>
    </Item>
  )

}