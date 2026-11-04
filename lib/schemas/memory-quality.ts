import { z } from "zod";

export const MemoryFeedbackSignalSchema = z.enum(["up", "down"]);
export type MemoryFeedbackSignal = z.infer<typeof MemoryFeedbackSignalSchema>;

export const MemoryFeedbackSourceSchema = z.enum(["memory_lens", "memory_ingest"]);
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
  note: z.string().nullable(),
  note_approved_at: z.string().nullable(),
  shared_memory: z.string().nullable(),
  memory_shared_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  revision: z.number().int().positive(),
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

export const RecordMemoryFeedbackInputSchema = z
  .object({
    memoryId: z.string().min(1).max(256),
    signal: MemoryFeedbackSignalSchema,
    source: MemoryFeedbackSourceSchema,
  })
  .strict();

export type RecordMemoryFeedbackInput = z.infer<typeof RecordMemoryFeedbackInputSchema>;

export const FeedbackNoteInputSchema = z
  .object({
    feedbackId: z.string().uuid(),
    memoryId: z.string().min(1).max(256),
    revision: z.number().int().positive(),
    note: z.string().trim().min(1).max(2000),
    approved: z.literal(true),
  })
  .strict();

export type FeedbackNoteInput = z.infer<typeof FeedbackNoteInputSchema>;

export const FeedbackMutationInputSchema = FeedbackNoteInputSchema.pick({
  feedbackId: true,
  memoryId: true,
  revision: true,
});
export type FeedbackMutationInput = z.infer<typeof FeedbackMutationInputSchema>;

// Preserve the exact preview, including whitespace; never silently truncate a shared memory.
export const SharedFeedbackMemoryTextSchema = z.string().min(1).max(16000);
export const ShareFeedbackMemoryInputSchema = FeedbackMutationInputSchema.extend({
  memoryText: SharedFeedbackMemoryTextSchema,
  approved: z.literal(true),
}).strict();
export type ShareFeedbackMemoryInput = z.infer<typeof ShareFeedbackMemoryInputSchema>;

export const FeedbackDraftInputSchema = FeedbackMutationInputSchema.extend({
  messages: z
    .array(
      z
        .object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(3000),
        })
        .strict()
    )
    .min(1)
    .max(20),
})
  .strict()
  .refine((input) => input.messages.at(-1)?.role === "user", {
    message: "A user message is required",
  });
export type FeedbackDraftInput = z.infer<typeof FeedbackDraftInputSchema>;

export const FeedbackDraftResultSchema = z.object({
  reply: z.string().min(1).max(1500),
  summary: z.string().min(1).max(2000).nullable(),
});
export type FeedbackDraftResult = z.infer<typeof FeedbackDraftResultSchema>;
