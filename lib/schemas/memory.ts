import z from "zod";

export const Mem0Message = z.object({
  role: z.string(),
  content: z.string(),
});

export type Mem0MessageType = z.infer<typeof Mem0Message>;

// MemoryItem schema based on mem0ai/oss structure
export const MemoryItem = z.object({
  id: z.string(),
  memory: z.string(),
  hash: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  score: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type MemoryItemType = z.infer<typeof MemoryItem>;

// SearchResult schema
export const SearchResult = z.object({
  results: z.array(MemoryItem),
  relations: z.array(z.unknown()).optional(),
});

export type SearchResultType = z.infer<typeof SearchResult>;
