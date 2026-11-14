import { describe, expect, test } from "bun:test";

import { executeErgonDocument } from "@/lib/llm/ergon-document-execute";
import type { ErgonDocumentDeps } from "@/lib/llm/ergon-document-execute";
import type { ErgonDocument } from "@/lib/schemas/ergon-documents";

const THREAD_ID = "550e8400-e29b-41d4-a716-446655440000";
const DOC_ID = "550e8400-e29b-41d4-a716-446655440001";

function makeDoc(overrides: Partial<ErgonDocument> = {}): ErgonDocument {
  return {
    id: DOC_ID,
    owner_id: "owner-1",
    thread_id: THREAD_ID,
    kanban_item_id: "item-1",
    title: "Spec",
    content: "# Body",
    format: "markdown",
    version: 1,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("executeErgonDocument", () => {
  test("CREATE_DOCUMENT links via data channel", async () => {
    const writes: unknown[] = [];
    const deps: ErgonDocumentDeps = {
      createDocument: async () => makeDoc(),
      updateDocument: async () => makeDoc({ version: 2 }),
      getDocument: async () => makeDoc(),
      listDocumentsForThread: async () => [],
    };

    const result = await executeErgonDocument(
      {
        command: {
          type: "CREATE_DOCUMENT",
          itemId: "item-1",
          title: "Spec",
          content: "# Body",
        },
        threadId: THREAD_ID,
        writer: {
          write: (part) => writes.push(part),
        },
      },
      deps
    );

    expect(result.action).toBe("created");
    expect(writes).toHaveLength(1);
    expect((writes[0] as { data: { type: string } }).data.type).toBe("LINK_DOCUMENT");
  });

  test("READ_DOCUMENT returns content", async () => {
    const deps: ErgonDocumentDeps = {
      createDocument: async () => makeDoc(),
      updateDocument: async () => makeDoc(),
      getDocument: async () => makeDoc({ content: "secret" }),
      listDocumentsForThread: async () => [],
    };

    const result = await executeErgonDocument(
      {
        command: { type: "READ_DOCUMENT", documentId: DOC_ID },
        threadId: THREAD_ID,
      },
      deps
    );

    expect(result.action).toBe("read");
    expect(result.content).toBe("secret");
  });

  test("rejects document from another thread", async () => {
    const deps: ErgonDocumentDeps = {
      createDocument: async () => makeDoc(),
      updateDocument: async () => makeDoc(),
      getDocument: async () => makeDoc({ thread_id: "other-thread" }),
      listDocumentsForThread: async () => [],
    };

    const result = await executeErgonDocument(
      {
        command: { type: "OPEN_DOCUMENT", documentId: DOC_ID },
        threadId: THREAD_ID,
      },
      deps
    );

    expect(result.action).toBe("error");
  });
});
