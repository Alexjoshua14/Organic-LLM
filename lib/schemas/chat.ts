import type { GatewayModelId } from "@ai-sdk/gateway";

import z from "zod";

import { CHAT_EXPERIENCES, parseChatExperience } from "@/lib/chat/chat-experience";
import { parseChatStyle, ChatStyleSchema } from "@/lib/chat/chat-style";
import { ChatEffortLevelSchema } from "@/lib/schemas/chat-effort";
import type { DeviceTier } from "@/lib/memory-ingest/delphi-caption-budget";
import {
  type DrawerChatDisplayInput,
  type DrawerSheetSnap,
} from "@/lib/rabbit-holes/drawer-chat-ui-budget";
import { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat-model-ids";
import type { ChatModel } from "@/lib/schemas/chat-models";

export type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
export {
  CHAT_EFFORT_LEVELS,
  DEFAULT_CHAT_EFFORT,
  buildEffortProviderOptions,
  clampEffortForModel,
  getChatEffortLabel,
  getEffortCapabilityForModel,
  getEffortLevelsForModel,
  modelSupportsEffortControl,
} from "@/lib/schemas/chat-effort";
export { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat-model-ids";
export {
  AUTO_CHAT_MODEL,
  AUTO_RESOLVED_SONNET_MODEL_ID,
  CHAT_MODEL_ALIASES,
  ChatModelCatalog,
  ChatModels,
  DEFAULT_CHAT_MODEL,
  MODEL_ALIASES,
  models,
  chatModelByAlias,
  chatModelById,
  requireChatModel,
  getSelectableChatModels,
  providerModelSlug,
  type ChatModel,
  type ChatModelAlias,
  type ChatModelId,
  type ModelAlias,
  type ModelProvider,
} from "@/lib/schemas/chat-models";

// Message role enum
export const MessageRole = z.enum(["user", "assistant", "system"]);

// Message schema kind enum
export const MessageSchemaKind = z.enum(["ui_message"]);

export const ChatModelSchema: z.ZodType<ChatModel> = z.object({
  id: z.union([z.literal(AUTO_CHAT_MODEL_ID), z.string()]),
  name: z.string(),
  alias: z.string().optional(),
  picker: z.boolean().optional(),
  supportsZeroDataRetention: z.boolean().optional(),
  adminOnly: z.boolean().optional(),
}) as z.ZodType<ChatModel>;

/** Re-export for call sites that only need the gateway model id union. */
export type { GatewayModelId };

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
  arcadia_starter_key: z.string().nullable().optional(),
});

export const ThreadUpdate = z.object({
  title: z.string().max(255).optional(),
  id: z.uuid(),
  owner_id: z.uuid(),
  active_stream_id: z.string().nullable().optional(),
  active_stream_started_at: z.string().nullable().optional(),
  arcadia_starter_key: z.string().nullable().optional(),
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

export const DelphiDisplayRequestSchema = z.object({
  viewportWidthPx: z.number().finite().positive(),
  viewportHeightPx: z.number().finite().positive(),
  devicePixelRatio: z.number().finite().positive(),
  screenWidthPx: z.number().finite().positive(),
  screenHeightPx: z.number().finite().positive(),
  captionWidthPx: z.number().finite().positive(),
  captionAllocatedHeightPx: z.number().finite().positive(),
  fontSizePx: z.number().finite().positive(),
  lineHeightPx: z.number().finite().positive(),
  avgCharWidthPx: z.number().finite().positive().optional(),
  userAgent: z.string().max(512).optional(),
  deviceTier: z.enum(["mobile", "tablet", "desktop"] satisfies [DeviceTier, DeviceTier, DeviceTier]),
  rootFontSizePx: z.number().finite().positive().optional(),
});

export const DrawerChatDisplayRequestSchema = z.object({
  viewportWidthPx: z.number().finite().positive(),
  viewportHeightPx: z.number().finite().positive(),
  sheetSnap: z.enum(["collapsed", "half", "full"] satisfies [DrawerSheetSnap, DrawerSheetSnap, DrawerSheetSnap]),
  aiBlockMaxHeightPx: z.number().finite().positive(),
  aiBlockWidthPx: z.number().finite().positive(),
  fontSizePx: z.number().finite().positive(),
  lineHeightPx: z.number().finite().positive(),
  prefersReducedMotion: z.boolean().optional().default(false),
});

export type { DrawerChatDisplayInput };

export const ChatRequestSchema = z.object({
  message: UIMessageSchema,
  id: z.uuid(),
  model: ChatModelSchema.optional(),
  /** Reasoning effort hint; `auto` or omitted leaves provider defaults unchanged. */
  effort: ChatEffortLevelSchema.optional(),
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
    ChatStyleSchema.optional()
  ),
  /** Strata page assistant: server loads this page for grounding when `experience` is `strata_page`. */
  strataPageId: z.string().uuid().optional(),
  /** When true, request is in zero-data-retention mode (no persistence). */
  zeroDataRetention: z.boolean().optional(),
  /** When true, spatial artifact sync and library features are enabled. */
  coalescenceMode: z.boolean().optional(),
  /** Client hint: thread already has a title; server can skip ensureChatHasTitle and optionally getThreadHasTitle. */
  threadHasTitle: z.boolean().optional(),
  /** Memory ingest: measured caption/display geometry for Delphi response-length guidance. */
  delphiDisplay: DelphiDisplayRequestSchema.optional(),
  /** Rabbit hole drawer: measured AI block geometry for response-length guidance. */
  drawerDisplay: DrawerChatDisplayRequestSchema.optional(),
  /** Rabbit hole session id when experience is rabbit_hole. */
  rabbitHoleSessionId: z.string().uuid().optional(),
  /** Diagram node reference chips from the composer (cap 10). */
  diagramNodeLinks: z
    .array(
      z.object({
        id: z.string(),
        diagramId: z.string(),
        nodeId: z.string(),
        label: z.string(),
        title: z.string().optional(),
        density: z.enum(["glance", "overview", "detailed"]).optional(),
        neighborhood: z.object({
          edges: z.array(
            z.object({
              from: z.string(),
              to: z.string(),
              label: z.string().optional(),
            })
          ),
          neighbors: z.array(z.object({ id: z.string(), label: z.string() })),
        }),
      })
    )
    .max(10)
    .optional(),
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
