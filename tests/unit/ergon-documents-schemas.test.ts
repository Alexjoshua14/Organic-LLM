import { describe, expect, test } from "bun:test";

import {
  ErgonDocumentCommandSchema,
  ErgonDocumentToolOutputSchema,
  OpenErgonDocumentRequestSchema,
} from "@/lib/schemas/ergon-documents";

describe("ergon document schemas", () => {
  test("CREATE_DOCUMENT command parses", () => {
    const parsed = ErgonDocumentCommandSchema.safeParse({
      type: "CREATE_DOCUMENT",
      itemId: "ticket-1",
      title: "Spec",
      content: "# Hello",
    });

    expect(parsed.success).toBe(true);
  });

  test("tool output parses created action", () => {
    const parsed = ErgonDocumentToolOutputSchema.safeParse({
      kind: "ergon-document",
      action: "created",
      document: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Spec",
        itemId: "ticket-1",
        version: 1,
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    });

    expect(parsed.success).toBe(true);
  });

  test("open request requires ids", () => {
    const parsed = OpenErgonDocumentRequestSchema.safeParse({
      chatId: "550e8400-e29b-41d4-a716-446655440001",
      messageId: "msg-1",
      toolCallId: "call-1",
    });

    expect(parsed.success).toBe(true);
  });
});
