import type { MemoryItem } from "mem0ai/oss";
import type { SortOption } from "@/types/memory-lens";

export function sortMemories(memories: MemoryItem[], sortBy: SortOption): MemoryItem[] {
  if (memories.length === 0) return memories;
  const copy = [...memories];

  if (sortBy === "recently-added") {
    copy.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return bTime - aTime;
    });
  } else {
    copy.sort((a, b) => {
      const aScore = typeof a.score === "number" ? a.score : -1;
      const bScore = typeof b.score === "number" ? b.score : -1;

      return bScore - aScore;
    });
  }

  return copy;
}
