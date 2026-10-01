import { z } from "zod";

import { ErgonDocumentSummarySchema } from "@/lib/schemas/ergon-documents";

import { KANBAN_VERSION } from "./shared";

/** Client-only channel command: link a durable document to a kanban item. */
export const KanbanLinkDocumentCommandSchema = z.object({
  type: z.literal("LINK_DOCUMENT"),
  version: KANBAN_VERSION,
  itemId: z.string().min(1).max(120),
  document: ErgonDocumentSummarySchema,
});

export type KanbanLinkDocumentCommand = z.infer<typeof KanbanLinkDocumentCommandSchema>;
