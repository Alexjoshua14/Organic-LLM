import { z } from "zod";

/** Aion Ergon document tool name (client-safe constant). */
export const ERGON_DOCUMENT_TOOL_NAME = "ergon_document";

export const ERGON_DOCUMENT_CAPS = {
  title: 160,
  content: 40_000,
  documentsPerItem: 5,
  itemId: 120,
} as const;

export const ErgonDocumentRefSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(ERGON_DOCUMENT_CAPS.title),
});

export type ErgonDocumentRef = z.infer<typeof ErgonDocumentRefSchema>;

export const ErgonDocumentFormatSchema = z.enum(["markdown"]);

export const ErgonDocumentSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  thread_id: z.string().uuid(),
  kanban_item_id: z.string().min(1).max(ERGON_DOCUMENT_CAPS.itemId),
  title: z.string().min(1).max(ERGON_DOCUMENT_CAPS.title),
  content: z.string().max(ERGON_DOCUMENT_CAPS.content),
  format: ErgonDocumentFormatSchema.default("markdown"),
  version: z.number().int().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ErgonDocument = z.infer<typeof ErgonDocumentSchema>;

export const ErgonDocumentSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  itemId: z.string(),
  version: z.number().int(),
  updatedAt: z.string(),
});

export type ErgonDocumentSummary = z.infer<typeof ErgonDocumentSummarySchema>;

export const CreateErgonDocumentCommandSchema = z.object({
  type: z.literal("CREATE_DOCUMENT"),
  itemId: z.string().min(1).max(ERGON_DOCUMENT_CAPS.itemId),
  title: z.string().min(1).max(ERGON_DOCUMENT_CAPS.title),
  content: z.string().min(1).max(ERGON_DOCUMENT_CAPS.content),
});

export const UpdateErgonDocumentCommandSchema = z.object({
  type: z.literal("UPDATE_DOCUMENT"),
  documentId: z.string().uuid(),
  title: z.string().min(1).max(ERGON_DOCUMENT_CAPS.title).optional(),
  content: z.string().min(1).max(ERGON_DOCUMENT_CAPS.content),
});

export const ReadErgonDocumentCommandSchema = z.object({
  type: z.literal("READ_DOCUMENT"),
  documentId: z.string().uuid(),
});

export const OpenErgonDocumentCommandSchema = z.object({
  type: z.literal("OPEN_DOCUMENT"),
  documentId: z.string().uuid(),
});

export const ErgonDocumentCommandSchema = z.discriminatedUnion("type", [
  CreateErgonDocumentCommandSchema,
  UpdateErgonDocumentCommandSchema,
  ReadErgonDocumentCommandSchema,
  OpenErgonDocumentCommandSchema,
]);

export type ErgonDocumentCommand = z.infer<typeof ErgonDocumentCommandSchema>;

export const ErgonDocumentToolOutputSchema = z.object({
  kind: z.literal("ergon-document"),
  action: z.enum(["created", "updated", "read", "opened", "error"]),
  document: ErgonDocumentSummarySchema.optional(),
  content: z.string().optional(),
  error: z.string().optional(),
});

export type ErgonDocumentToolOutput = z.infer<typeof ErgonDocumentToolOutputSchema>;

export const OpenErgonDocumentRequestSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().min(1),
  toolCallId: z.string().min(1),
});

export type OpenErgonDocumentRequest = z.infer<typeof OpenErgonDocumentRequestSchema>;

export function toErgonDocumentSummary(doc: ErgonDocument): ErgonDocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    itemId: doc.kanban_item_id,
    version: doc.version,
    updatedAt: doc.updated_at,
  };
}
