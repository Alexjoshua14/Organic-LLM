import z from "zod";

/**
 * Enum of available AI server functions that can be invoked
 * Similar to MCP tools - predefined server actions that can be queued
 */
export const AIServerFunction = z.enum([
  "generateResponse",
  "analyzeContent",
  "processRabbitHole",
  "summarizeThread",
  "extractInsights",
  // Add more server functions as needed
]);

export type AIServerFunction = z.infer<typeof AIServerFunction>;

/**
 * Job status enum
 */
export const JobStatus = z.enum([
  "pending",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export type JobStatus = z.infer<typeof JobStatus>;

/**
 * Schema for creating a new AI job
 */
export const AIJobCreate = z.object({
  function: AIServerFunction,
  parameters: z.record(z.string(), z.unknown()).optional().default({}),
  priority: z.number().int().min(1).max(5).default(3),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const AIJobUpdate = z.object({
  status: JobStatus.optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type AIJobInsert = z.infer<typeof AIJobCreate>;
export type AIJobPatch = z.infer<typeof AIJobUpdate>;
