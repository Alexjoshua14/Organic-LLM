import type { GatewayModelId } from "@ai-sdk/gateway";

import z from "zod";

import { CHAT_EXPERIENCES, parseChatExperience } from "@/lib/chat/chat-experience";
import { parseChatStyle } from "@/lib/chat/chat-style";

// Message role enum
export const MessageRole = z.enum(["user", "assistant", "system"]);

// Message schema kind enum
export const MessageSchemaKind = z.enum(["ui_message"]);

/** Sentinel: resolved on the server before any gateway / streamText call. */
export const AUTO_CHAT_MODEL_ID = "organic-llm/auto" as const;

/** Non-Delphi `AUTO_CHAT_MODEL_ID` resolves to this gateway id (single policy knob). */
export const AUTO_RESOLVED_SONNET_MODEL_ID = "anthropic/claude-sonnet-4.6" as const;

export type ChatModelId = GatewayModelId | typeof AUTO_CHAT_MODEL_ID;

export type ChatModel = {
  id: ChatModelId;
  name: string;
  supportsZeroDataRetention?: boolean;
};

export const ChatModelSchema: z.ZodType<ChatModel> = z.object({
  id: z.union([z.literal(AUTO_CHAT_MODEL_ID), z.string()]),
  name: z.string(),
  supportsZeroDataRetention: z.boolean().optional(),
}) as z.ZodType<ChatModel>;

/** Re-export for call sites that only need the gateway model id union. */
export type { GatewayModelId };

export const AUTO_CHAT_MODEL: ChatModel = {
  id: AUTO_CHAT_MODEL_ID,
  name: "Auto",
  supportsZeroDataRetention: true,
};

const gatewayChatModels: ChatModel[] = [
  { id: "openai/gpt-5.4", name: "GPT-5.4", supportsZeroDataRetention: true },
  { id: "openai/gpt-5.4-mini", name: "GPT-5 Mini", supportsZeroDataRetention: true },
  { id: "openai/gpt-5.4-nano", name: "GPT-5 Nano", supportsZeroDataRetention: true },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", supportsZeroDataRetention: true },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", supportsZeroDataRetention: true },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    supportsZeroDataRetention: true,
  },
  { id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7", supportsZeroDataRetention: true },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    supportsZeroDataRetention: true,
  },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", supportsZeroDataRetention: true },
  { id: "perplexity/sonar-pro", name: "Sonar Pro", supportsZeroDataRetention: false },
  {
    id: "perplexity/sonar-reasoning-pro",
    name: "Sonar Reasoning Pro",
    supportsZeroDataRetention: false,
  },
  { id: "perplexity/sonar-reasoning", name: "Sonar Reasoning", supportsZeroDataRetention: false },
  { id: "moonshotai/kimi-k2.5", name: "Kimi v2.5", supportsZeroDataRetention: true },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek v3.2", supportsZeroDataRetention: true },
  {
    id: "deepseek/deepseek-v3.2-thinking",
    name: "DeepSeek v3.2 Thinking",
    supportsZeroDataRetention: true,
  },
  { id: "openai/gpt-oss-120b", name: "GPT OSS [120b]", supportsZeroDataRetention: true },
  { id: "openai/gpt-oss-20b", name: "GPT OSS [20b]", supportsZeroDataRetention: true },
];

/** First entry is Auto; default fixed model remains the first real gateway id. */
export const ChatModels: ChatModel[] = [AUTO_CHAT_MODEL, ...gatewayChatModels];

export const DEFAULT_CHAT_MODEL: ChatModel = gatewayChatModels[0];

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
  active_stream_id: z.string().nullable().optional(),
  active_stream_started_at: z.string().nullable().optional(),
});

export const ThreadUpdate = z.object({
  title: z.string().max(255).optional(),
  id: z.uuid(),
  owner_id: z.uuid(),
  active_stream_id: z.string().nullable().optional(),
  active_stream_started_at: z.string().nullable().optional(),
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

const ToolInvocationPartSchema = z.object({
  type: z.literal("tool-invocation"),
  toolInvocationId: z.string(),
  toolName: z.string(),
  args: z.unknown().optional(),
  state: z.enum(["partial-call", "call", "result", "output-error"]),
  result: z.any().optional(),
  errorText: z.string().optional(),
});

const UnknownPartSchema = z
  .object({
    type: z.string(),
  })
  .loose();

const MessagePartSchema = z.union([TextPartSchema, ToolInvocationPartSchema]).or(UnknownPartSchema);

export const UIMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system", "data"]),
    parts: z.array(MessagePartSchema).default([]),
    content: z.string().optional(),
    createdAt: z.number().optional(),
    model: z.string().optional(),
    totalTokens: z.number().optional(),
  })
  .loose() // Allow extra fields
  .refine((message) => message.parts.length > 0 || typeof message.content === "string", {
    message: "Message must include parts or content",
  });

export const StrataAssistantPersonaRequestSchema = z.enum(["remy", "spark", "aion", "prometheus"]);

/** Re-export for callers that branch on product mode. */
export type { ChatExperience } from "@/lib/chat/chat-experience";

const ChatExperienceSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string") return undefined;

  return parseChatExperience(val);
}, z.enum(CHAT_EXPERIENCES).optional());

export const ChatRequestSchema = z.object({
  message: UIMessageSchema,
  id: z.uuid(),
  model: ChatModelSchema.optional(),
  webSearch: z.boolean().optional(),
  memory: z.boolean().optional().default(true),
  speechFriendly: z.boolean().optional(),
  /** When false, chat history retrieval tools are omitted. Default true for backward compatibility. */
  messageSearch: z.boolean().optional().default(true),
  /** Strata page assistant: optional knowledge graph tools (stubbed persistence). */
  knowledgeSearch: z.boolean().optional().default(false),
  /** Strata page assistant: persona affecting system prompt and default model client-side. */
  strataAssistantPersona: StrataAssistantPersonaRequestSchema.optional(),
  /** Client hint: which chat experience initiated the request (case-insensitive; unknown values omitted). */
  experience: ChatExperienceSchema,
  /** Client hint: selected structured chat flow (e.g. `ergon` kanban). Unknown values omitted. */
  chatStyle: z.preprocess(
    (val) => (typeof val === "string" ? parseChatStyle(val) : undefined),
    z.enum(["default", "ergon", "scribe"]).optional()
  ),
  /** Strata page assistant: server loads this page for grounding when `experience` is `strata_page`. */
  strataPageId: z.string().uuid().optional(),
  /** When true, request is in zero-data-retention mode (no persistence). */
  zeroDataRetention: z.boolean().optional(),
  /** Client hint: thread already has a title; server can skip ensureChatHasTitle and optionally getThreadHasTitle. */
  threadHasTitle: z.boolean().optional(),
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
