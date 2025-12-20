import z from "zod";

export const Mem0Message = z.object({
  role: z.string(),
  content: z.string(),
});

export type Mem0MessageType = z.infer<typeof Mem0Message>;
