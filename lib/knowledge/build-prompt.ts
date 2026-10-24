import type { MemoryItemType } from "@/lib/schemas/memory";

export function formatMemoriesBlock(memories: MemoryItemType[], maxItems = 40): string {
  if (!memories.length) return "No relevant stored memories found.";

  return memories
    .slice(0, maxItems)
    .map((memory, index) => {
      const score = typeof memory.score === "number" ? memory.score.toFixed(3) : "unscored";

      return `[Evidence ${index + 1} | id=${memory.id} | score=${score}]
"""
${memory.memory}
"""`;
    })
    .join("\n\n");
}
