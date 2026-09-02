import type { ErgonDocument, ErgonDocumentSummary, ErgonDocumentToolOutput } from "@/lib/schemas/ergon-documents";
import type { KanbanStreamWriter } from "@/lib/llm/kanban-tool";

import type { ErgonDocumentCommand } from "@/lib/schemas/ergon-documents";
import { toErgonDocumentSummary } from "@/lib/schemas/ergon-documents";

/** Data-layer functions the tool needs; injected so the executor stays testable. */
export type ErgonDocumentDeps = {
  createDocument: (input: {
    threadId: string;
    kanbanItemId: string;
    title: string;
    content: string;
  }) => Promise<ErgonDocument>;
  updateDocument: (
    id: string,
    patch: { title?: string; content: string }
  ) => Promise<ErgonDocument>;
  getDocument: (id: string) => Promise<ErgonDocument | null>;
  listDocumentsForThread: (threadId: string) => Promise<ErgonDocument[]>;
};

export type ExecuteErgonDocumentParams = {
  command: ErgonDocumentCommand;
  threadId: string;
  writer?: KanbanStreamWriter;
};

function errorOutput(message: string): ErgonDocumentToolOutput {
  return { kind: "ergon-document", action: "error", error: message };
}

function emitLinkDocument(
  writer: KanbanStreamWriter | undefined,
  itemId: string,
  document: ErgonDocumentSummary
): void {
  writer?.write({
    type: "data-kanban",
    data: {
      type: "LINK_DOCUMENT",
      version: 1,
      itemId,
      document,
    },
    transient: true,
  });
}

async function countDocumentsForItem(
  deps: ErgonDocumentDeps,
  threadId: string,
  itemId: string
): Promise<number> {
  const docs = await deps.listDocumentsForThread(threadId);

  return docs.filter((doc) => doc.kanban_item_id === itemId).length;
}

/**
 * Server-side executor for the Ergon `ergon_document` tool.
 * Pure orchestration over injected data-layer deps.
 */
export async function executeErgonDocument(
  params: ExecuteErgonDocumentParams,
  deps: ErgonDocumentDeps
): Promise<ErgonDocumentToolOutput> {
  const { command, threadId, writer } = params;

  try {
    switch (command.type) {
      case "CREATE_DOCUMENT": {
        const existingCount = await countDocumentsForItem(deps, threadId, command.itemId);

        if (existingCount >= 5) {
          return errorOutput("This ticket already has the maximum number of linked documents.");
        }

        const doc = await deps.createDocument({
          threadId,
          kanbanItemId: command.itemId,
          title: command.title,
          content: command.content,
        });
        const ref = toErgonDocumentSummary(doc);

        emitLinkDocument(writer, command.itemId, ref);

        return {
          kind: "ergon-document",
          action: "created",
          document: toErgonDocumentSummary(doc),
        };
      }

      case "UPDATE_DOCUMENT": {
        const existing = await deps.getDocument(command.documentId);

        if (!existing || existing.thread_id !== threadId) {
          return errorOutput("Document not found for this thread.");
        }

        const doc = await deps.updateDocument(command.documentId, {
          title: command.title,
          content: command.content,
        });
        const ref = toErgonDocumentSummary(doc);

        emitLinkDocument(writer, doc.kanban_item_id, ref);

        return {
          kind: "ergon-document",
          action: "updated",
          document: toErgonDocumentSummary(doc),
        };
      }

      case "READ_DOCUMENT": {
        const doc = await deps.getDocument(command.documentId);

        if (!doc || doc.thread_id !== threadId) {
          return errorOutput("Document not found for this thread.");
        }

        return {
          kind: "ergon-document",
          action: "read",
          document: toErgonDocumentSummary(doc),
          content: doc.content,
        };
      }

      case "OPEN_DOCUMENT": {
        const doc = await deps.getDocument(command.documentId);

        if (!doc || doc.thread_id !== threadId) {
          return errorOutput("Document not found for this thread.");
        }

        return {
          kind: "ergon-document",
          action: "opened",
          document: toErgonDocumentSummary(doc),
        };
      }

      default:
        return errorOutput("Unknown command.");
    }
  } catch (error) {
    return errorOutput(error instanceof Error ? error.message : "Failed to manage document.");
  }
}
