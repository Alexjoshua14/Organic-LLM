import { z } from "zod";

export const MemoryFeedbackSignalSchema = z.enum(["up", "down", "flag_review", "flag_followup"]);
export type MemoryFeedbackSignal = z.infer<typeof MemoryFeedbackSignalSchema>;

export const MemoryFeedbackSourceSchema = z.enum([
  "memory_lens",
  "memory_ingest",
  "delphi_tool",
]);
export type MemoryFeedbackSource = z.infer<typeof MemoryFeedbackSourceSchema>;

export const MemoryQualityEventTypeSchema = z.enum(["ingest", "delete", "feedback", "eval_run"]);
export type MemoryQualityEventType = z.infer<typeof MemoryQualityEventTypeSchema>;

export const MemoryQualitySourceSchema = z.enum([
  "delphi",
  "auto_ingest",
  "migration",
  "eval",
  "unknown",
]);
export type MemoryQualitySource = z.infer<typeof MemoryQualitySourceSchema>;

export const MemoryFeedbackRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  memory_id: z.string(),
  signal: MemoryFeedbackSignalSchema,
  source: MemoryFeedbackSourceSchema,
  chat_id: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  created_at: z.string(),
});

export type MemoryFeedbackRow = z.infer<typeof MemoryFeedbackRowSchema>;

export const MemoryQualityDailyRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  day: z.string(),
  source: z.union([MemoryQualitySourceSchema, z.literal("all")]),
  ingest_count: z.number(),
  delete_count: z.number(),
  feedback_up: z.number(),
  feedback_down: z.number(),
  char_count_mean: z.number().nullable().optional(),
  char_count_p50: z.number().nullable().optional(),
  char_count_p90: z.number().nullable().optional(),
  delete_rate: z.number().nullable().optional(),
  positive_rate: z.number().nullable().optional(),
  updated_at: z.string(),
});

export type MemoryQualityDailyRow = z.infer<typeof MemoryQualityDailyRowSchema>;

export const RecordMemoryFeedbackInputSchema = z.object({
  memoryId: z.string().min(1).max(256),
  signal: MemoryFeedbackSignalSchema,
  source: MemoryFeedbackSourceSchema,
  chatId: z.string().max(256).optional(),
  note: z.string().max(500).optional(),
});

export type RecordMemoryFeedbackInput = z.infer<typeof RecordMemoryFeedbackInputSchema>;
