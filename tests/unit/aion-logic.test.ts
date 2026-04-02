import { describe, test, expect } from "bun:test";

import { ChatRequestSchema, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { getChatModel } from "@/lib/llm/helpers";
import { computeAionGeneratedMessageId } from "@/lib/api/aion-handler";

describe("Aion unit logic", () => {
  test("ChatRequestSchema: accepts a valid request", () => {
    const req = {
      id: "7b52de83-bf70-4b7b-8d9b-4a306b8b8d87",
      message: {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      memory: true,
    };

    const parsed = ChatRequestSchema.parse(req);
    expect(parsed.id).toBe(req.id);
    expect(parsed.message.role).toBe("user");
    expect(parsed.sendMode).toBe("respond");
  });

  test("ChatRequestSchema: accepts process_only send mode", () => {
    const req = {
      id: "7b52de83-bf70-4b7b-8d9b-4a306b8b8d87",
      message: {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "store this but do not respond" }],
      },
      sendMode: "process_only",
    };

    const parsed = ChatRequestSchema.parse(req);
    expect(parsed.sendMode).toBe("process_only");
  });

  test("ChatRequestSchema: rejects missing required fields", () => {
    const parsed = ChatRequestSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  test("getChatModel: returns DEFAULT_CHAT_MODEL when undefined", () => {
    const model = getChatModel(undefined);
    expect(model).toEqual(DEFAULT_CHAT_MODEL);
  });

  test("getChatModel: returns requested model when valid", () => {
    const model = getChatModel({ id: "openai/gpt-5.2", name: "GPT-5.2" });
    expect(model.id).toBe("openai/gpt-5.2");
  });

  test("computeAionGeneratedMessageId: reuses assistant id when last message is tool-only", () => {
    const id = computeAionGeneratedMessageId(
      [
        {
          id: "assistant-123",
          role: "assistant",
          parts: [
            { type: "step-start" },
            { type: "tool-call", toolName: "search_memories" },
          ],
        } as any,
      ],
      () => "new-id",
    );

    expect(id).toBe("assistant-123");
  });

  test("computeAionGeneratedMessageId: generates new id otherwise", () => {
    const id = computeAionGeneratedMessageId(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "hi" }],
        } as any,
      ],
      () => "new-id",
    );

    expect(id).toBe("new-id");
  });
});

