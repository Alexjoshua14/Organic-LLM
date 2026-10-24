import { randomUUID } from "crypto";
import type { UIMessage } from "ai";

import { ChatRequestSchema } from "@/lib/schemas/chat";

export function createTestUIMessage(
  // Keep overrides loose because the upstream `UIMessage` type varies by AI SDK version
  // (and Next's build typecheck includes tests/ in this repo).
  overrides: Record<string, any> = {},
): UIMessage {
  const content = overrides.content as string | undefined;
  return {
    id: overrides.id ?? randomUUID(),
    role: overrides.role ?? "user",
    parts:
      overrides.parts ??
      (content
        ? []
        : [
            {
              type: "text",
              text: "Hello from test",
            },
          ]),
    ...(content ? { content } : {}),
    createdAt: overrides.createdAt,
    ...overrides,
  } as UIMessage;
}

export function createTestChatRequest(
  overrides: Record<string, unknown> = {},
): unknown {
  const base = {
    id: randomUUID(),
    message: createTestUIMessage(),
    memory: true,
  };

  // Ensure the default fixture always matches the current schema.
  return ChatRequestSchema.parse({ ...base, ...overrides });
}

export function createTestContext(overrides?: {
  context?: string;
  messages?: UIMessage[];
}): { context: string; messages: UIMessage[] } {
  return {
    context: overrides?.context ?? "TEST_SYSTEM_PROMPT",
    messages: overrides?.messages ?? [],
  };
}

