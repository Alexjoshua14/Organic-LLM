import { useEffect, useState } from "react";
import { SearchResult } from "mem0ai/oss";

import { MemoryCard } from "./memoryCard";

import { getCurrentUserMemories } from "@/lib/memory/operations";

export const MemoryContainer = () => {
  const [memories, setMemories] = useState<SearchResult>({
    results: [],
    relations: [],
  });

  useEffect(() => {
    const fetchMemories = async () => {
      const result = await getCurrentUserMemories();

      if (result.error) {
        setMemories({ results: [], relations: [] });

        return;
      }
      if (result.data) {
        setMemories(result.data);
      }
    };

    fetchMemories();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {memories.results?.map((memory) => <MemoryCard key={memory.id} memory={memory} />)}
    </div>
  );
};
