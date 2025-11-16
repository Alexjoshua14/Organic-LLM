import z from "zod";

/**
 * TODO, replace z.any in messages with Zod schema for UIMessage
 */
export const ContextSchema = z.object({
  prompt: z.string().describe("The system prompt for the LLM."),
  messages: z.array(z.any()).describe("The messages to send to the LLM."),
});

/**
 * Schema for context portion that will be combined into the prompt for LLM call
 */
export const ContextPieceSchema = z.object({
  title: z
    .string()
    .describe("The title of the context piece.")
    .max(100)
    .optional(),
  content: z.string().describe("The content of the context piece.").max(10000),
});

export type Context = z.infer<typeof ContextSchema>;
export type ContextPiece = z.infer<typeof ContextPieceSchema>;
