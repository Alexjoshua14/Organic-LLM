import z from "zod";

// Message role enum
export const MessageRole = z.enum(["user", "assistant", "system"]);

// Message schema kind enum
export const MessageSchemaKind = z.enum(["ui_message"]);

// Thread schema
export const ThreadCreate = z.object({
  title: z.string().max(255).optional().nullable(),
  id: z.uuid().optional(),
  owner_id: z.uuid().optional(),
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

// Type exports
export type Thread = z.infer<typeof ThreadSchema>;
export type ThreadInsert = z.infer<typeof ThreadCreate>;
export type ThreadPatch = z.infer<typeof ThreadUpdate>;
export type Message = z.infer<typeof MessageSchema>;
export type MessageInsert = z.infer<typeof MessageCreate>;
export type MessagePatch = z.infer<typeof MessageUpdate>;
export type MessageRoleType = z.infer<typeof MessageRole>;
