import { describe, expect, test } from "bun:test";

import { buildOpenDocumentMessage } from "@/lib/ergon-documents/open-message";
import { ERGON_DOCUMENT_TOOL_NAME } from "@/lib/schemas/ergon-documents";

describe("buildOpenDocumentMessage", () => {
  test("builds canonical assistant tool message", () => {
    const message = buildOpenDocumentMessage({
      messageId: "msg-open-1",
      toolCallId: "call-open-1",
      document: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Spec",
        itemId: "item-1",
        version: 2,
        updatedAt: "2026-09-01T12:00:00.000Z",
      },
    });

    expect(message.role).toBe("assistant");
    expect(message.id).toBe("msg-open-1");
    expect(message.parts).toHaveLength(1);

    const part = message.parts[0] as {
      type: string;
      toolName: string;
      state: string;
      output: { action: string };
    };

    expect(part.type).toBe("dynamic-tool");
    expect(part.toolName).toBe(ERGON_DOCUMENT_TOOL_NAME);
    expect(part.state).toBe("output-available");
    expect(part.output.action).toBe("opened");
  });
});
