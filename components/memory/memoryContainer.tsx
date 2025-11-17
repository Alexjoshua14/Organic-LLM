import { useEffect, useState } from "react";
import { MemoryCard } from "./memoryCard";
import { getAllMemories } from "@/lib/memory/operations";
import { SearchResult } from "mem0ai/oss";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { useAuth } from "@clerk/nextjs";
import { createLogger } from "@/lib/logger";

const logger = createLogger("components/memory/memoryContainer.tsx");

export const MemoryContainer = () => {
  const [memories, setMemories] = useState<SearchResult>({
    results: [],
    relations: [],
  });
  const [sbUserId, setSbUserId] = useState<string | null>(null);
  const { userId: clerkUserId } = useAuth();

  useEffect(() => {
    const fetchSbUserId = async () => {
      if (!clerkUserId) {
        logger.error("MemoryContainer", "No active user identified");
        return;
      }
      const sbUserIdResult = await getSupabaseUserId(clerkUserId);
      if (sbUserIdResult.error || sbUserIdResult.data === null) {
        logger.error("MemoryContainer", "User not found in supabase");
        return;
      }
      setSbUserId(sbUserIdResult.data);
    }
    fetchSbUserId();
  }, [clerkUserId]);

  useEffect(() => {
    const fetchMemories = async () => {
      if (!sbUserId) {
        logger.error("MemoryContainer", "No active user identified");
        return;
      }
      const memories = await getAllMemories(sbUserId);
      setMemories(memories);
    }
    fetchMemories();
  }, [sbUserId]);

  return (
    <div className="flex flex-col gap-2">
      {memories.results?.map((memory) => (
        <MemoryCard key={memory.id} memory={memory} />
      ))}
    </div>
  )
}