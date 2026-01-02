import z from "zod";

// Message role enum
export const MessageRole = z.enum(["user", "assistant", "system"]);

// Message schema kind enum
export const MessageSchemaKind = z.enum(["ui_message"]);

// Approved chat models enum
export const ChatModelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type ChatModel = z.infer<typeof ChatModelSchema>;

export const ChatModels: ChatModel[] = [
  { id: "openai/gpt-5.2", name: "GPT-5.2" },
  { id: "openai/gpt-5", name: "GPT-5" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "openai/gpt-oss-120b", name: "GPT OSS [120b]" },
  { id: "openai/gpt-oss-20b", name: "GPT OSS [20b]" },
] as const;

export const DEFAULT_CHAT_MODEL: ChatModel = ChatModels[0];

// Thread schema
export const ThreadCreate = z.object({
  title: z.string().max(255).optional().nullable(),
  id: z.uuid().optional(),
  owner_id: z.uuid().optional(),
  pinned: z.boolean().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ThreadSchema = ThreadCreate.partial({ owner_id: true }).extend({
  id: z.uuid(),
});

export const ThreadUpdate = z.object({
  title: z.string().max(255).optional(),
  id: z.uuid(),
  owner_id: z.uuid(),
});

// Message schema
export const MessageSchema = z.object({
  content: z.any(),
  role: MessageRole,
  id: z.uuid(),
  thread_id: z.uuid(),
  text_excerpt: z.string().max(1000).optional(),
  schema_kind: MessageSchemaKind,
  schema_version: z.number().int().min(1).default(1),
});

// Message schema (duplicating for name consistency)
export const MessageCreate = MessageSchema;

export const MessageUpdate = z.object({
  content: z.any().optional(),
  text_excerpt: z.string().max(1000).optional(),
  schema_kind: MessageSchemaKind.optional(),
  schema_version: z.number().int().min(1).optional(),
});

const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const UIMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system", "data"]),
    parts: z.array(TextPartSchema).default([]),
    content: z.string().optional(),
    createdAt: z.number().optional(),
    model: z.string().optional(),
    totalTokens: z.number().optional(),
  })
  .refine(
    (message) =>
      message.parts.length > 0 || typeof message.content === "string",
    {
      message: "Message must include parts or content",
    }
  );

export const ChatRequestSchema = z.object({
  message: UIMessageSchema,
  id: z.uuid(),
  model: ChatModelSchema.optional(),
  webSearch: z.boolean().optional(),
  memory: z.boolean().optional().default(true),
});

export const ThreadSummarySchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid(),
  summary_text: z.string(),
  summary_tokens: z.number(),
  last_summarized_message_id: z.string(),
  last_summarized_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ThreadSummaryCreate = ThreadSummarySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export const ThreadSummaryUpdate = ThreadSummarySchema.partial({ id: true });

// Type exports
export type Thread = z.infer<typeof ThreadSchema>;
export type ThreadInsert = z.infer<typeof ThreadCreate>;
export type ThreadPatch = z.infer<typeof ThreadUpdate>;
export type Message = z.infer<typeof MessageSchema>;
export type MessageInsert = z.infer<typeof MessageCreate>;
export type MessagePatch = z.infer<typeof MessageUpdate>;
export type MessageRoleType = z.infer<typeof MessageRole>;
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;
export type ThreadSummaryInsert = z.infer<typeof ThreadSummaryCreate>;
export type ThreadSummaryPatch = z.infer<typeof ThreadSummaryUpdate>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
