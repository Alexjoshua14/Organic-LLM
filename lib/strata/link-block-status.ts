import z from "zod";

export const StrataLinkBlockStatusCodeSchema = z.enum([
  "input_received",
  "starting_web_search",
  "fetching_content",
  "summarizing",
  "results_ready",
  "streaming_response",
  "completed",
  "error",
]);

export type StrataLinkBlockStatusCode = z.infer<typeof StrataLinkBlockStatusCodeSchema>;

export const StrataLinkBlockStatusEventSchema = z.object({
  blockId: z.string().uuid(),
  code: StrataLinkBlockStatusCodeSchema,
  message: z.string().min(1).max(280),
  at: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type StrataLinkBlockStatusEvent = z.infer<typeof StrataLinkBlockStatusEventSchema>;

export const StrataLinkBlockResultSchema = z.object({
  blockId: z.string().uuid(),
  title: z.string().max(512),
  url: z.string().max(2048),
  summary: z.string().max(8000),
  estimatedCostUsd: z.number().nonnegative(),
  canEscalate: z.boolean().default(true),
});

export type StrataLinkBlockResult = z.infer<typeof StrataLinkBlockResultSchema>;

export const StrataLinkBlockStreamChunkSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    event: StrataLinkBlockStatusEventSchema,
  }),
  z.object({
    type: z.literal("result"),
    result: StrataLinkBlockResultSchema,
  }),
  z.object({
    type: z.literal("error"),
    error: z.string().min(1).max(500),
  }),
]);

export type StrataLinkBlockStreamChunk = z.infer<typeof StrataLinkBlockStreamChunkSchema>;

export const LINK_BLOCK_STATUS_COPY: Record<StrataLinkBlockStatusCode, string> = {
  input_received: "Input received from user",
  starting_web_search: "Starting web search",
  fetching_content: "Fetching content",
  summarizing: "Generating concise summary",
  results_ready: "Search results ready",
  streaming_response: "Streaming back response",
  completed: "Completed",
  error: "Processing failed",
};
