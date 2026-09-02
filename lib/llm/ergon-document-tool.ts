import type { ErgonDocumentDeps } from "@/lib/llm/ergon-document-execute";

import { tool } from "ai";
import { z } from "zod";

import {
  createErgonDocument,
  getErgonDocument,
  listErgonDocumentsForThread,
  updateErgonDocument,
} from "@/data/supabase/ergon-documents";
import { executeErgonDocument } from "@/lib/llm/ergon-document-execute";
import type { KanbanStreamWriter } from "@/lib/llm/kanban-tool";
import { createLogger } from "@/lib/logger";
import {
  ERGON_DOCUMENT_TOOL_NAME,
  ErgonDocumentCommandSchema,
} from "@/lib/schemas/ergon-documents";

export { ERGON_DOCUMENT_TOOL_NAME };

const logger = createLogger("lib/llm/ergon-document-tool.ts");

const realDeps: ErgonDocumentDeps = {
  createDocument: async (input) => createErgonDocument(input),
  updateDocument: async (id, patch) => updateErgonDocument(id, patch),
  getDocument: async (id) => getErgonDocument(id),
  listDocumentsForThread: async (threadId) => listErgonDocumentsForThread(threadId),
};

/**
 * Ergon linked-document tool. Persists markdown documents to Supabase and links them
 * to kanban items via the transient `data-kanban` channel.
 */
export function createErgonDocumentTool({
  writer,
  threadId,
  deps = realDeps,
}: {
  writer?: KanbanStreamWriter;
  threadId: string;
  deps?: ErgonDocumentDeps;
}) {
  return tool({
    description:
      "Create, update, read, or open linked documents for Ergon kanban tickets. CREATE_DOCUMENT writes markdown content and links it to an existing item id. UPDATE_DOCUMENT replaces content in place (bumps version). READ_DOCUMENT returns content for your reasoning. OPEN_DOCUMENT surfaces a document in the thread viewer. Keep chat prose short — the document is the surface.",
    inputSchema: z.object({ command: ErgonDocumentCommandSchema }),
    execute: async ({ command }) => {
      const result = await executeErgonDocument({ command, threadId, writer }, deps);

      logger.log("ergon_document", "executed", {
        type: command.type,
        action: result.action,
        documentId: result.document?.id,
        error: result.error,
      });

      return result;
    },
  });
}
