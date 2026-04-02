import { describe, test, expect } from "bun:test";

import { convertUIMessageToMessage } from "@/lib/chat/message-transform";

describe("message-transform send mode", () => {
  test("persists send_mode for user messages when provided", () => {
    const row = convertUIMessageToMessage(
      {
        id: "8f197965-a272-4b2f-bc5f-56f4f45fd4dc",
        role: "user",
        parts: [{ type: "text", text: "Process this only" }],
        sendMode: "process_only",
      } as any,
      "778f7245-5eb6-4a1a-ad62-c1e899f95e19"
    );

    expect(row?.send_mode).toBe("process_only");
  });

  test("does not persist send_mode for assistant messages", () => {
    const row = convertUIMessageToMessage(
      {
        id: "8f197965-a272-4b2f-bc5f-56f4f45fd4dc",
        role: "assistant",
        parts: [{ type: "text", text: "Ack" }],
        sendMode: "process_only",
      } as any,
      "778f7245-5eb6-4a1a-ad62-c1e899f95e19"
    );

    expect(row?.send_mode).toBeNull();
  });
});
