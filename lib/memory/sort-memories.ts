import type { MemoryItem } from "mem0ai/oss";
import type { SortOption } from "@/types/memory-lens";

export function sortMemories(memories: MemoryItem[], sortBy: SortOption): MemoryItem[] {
  if (memories.length === 0) return memories;
  const copy = [...memories];

  if (sortBy === "recently-added") {
    copy.sort((a, b) => {
      const aTime = (a.createdAt ? Date.parse(a.createdAt) : 0) || 0;
      const bTime = (b.createdAt ? Date.parse(b.createdAt) : 0) || 0;

      return bTime - aTime;
    });
  } else {
    copy.sort((a, b) => {
      const aScore = typeof a.score === "number" && Number.isFinite(a.score) ? a.score : -1;
      const bScore = typeof b.score === "number" && Number.isFinite(b.score) ? b.score : -1;

      return bScore - aScore;
    });
  }

  return copy;
}
