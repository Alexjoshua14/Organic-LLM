import type { UIMessage } from "ai";

import type { ErgonDocumentSummary } from "@/lib/schemas/ergon-documents";
import { ERGON_DOCUMENT_TOOL_NAME } from "@/lib/schemas/ergon-documents";

export type BuildOpenDocumentMessageParams = {
  messageId: string;
  toolCallId: string;
  document: ErgonDocumentSummary;
};

/** Canonical synthetic assistant message for opening a linked Ergon document. */
export function buildOpenDocumentMessage({
  messageId,
  toolCallId,
  document,
}: BuildOpenDocumentMessageParams): UIMessage {
  return {
    id: messageId,
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: ERGON_DOCUMENT_TOOL_NAME,
        toolCallId,
        state: "output-available",
        input: {
          command: {
            type: "OPEN_DOCUMENT",
            documentId: document.id,
          },
        },
        output: {
          kind: "ergon-document",
          action: "opened",
          document,
        },
      } as UIMessage["parts"][number],
    ],
  };
}

export function newOpenDocumentIds(): { messageId: string; toolCallId: string } {
  const suffix = crypto.randomUUID();

  return {
    messageId: `ergon-doc-open-${suffix}`,
    toolCallId: `ergon-doc-open-call-${suffix}`,
  };
}
