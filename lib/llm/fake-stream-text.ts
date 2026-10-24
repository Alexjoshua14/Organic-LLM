import type { UIMessage } from "ai";

import { randomUUID } from "crypto";

/**
 * Minimal fake `streamText()` for local/E2E testing.
 *
 * It avoids calling any external LLM providers and instead immediately
 * finishes with a deterministic assistant message.
 */
export function fakeStreamText(_args: any): {
  toUIMessageStream: (args: {
    onEnd?: (args: {
      messages: UIMessage[];
      isAborted: boolean;
      finishReason?: string;
    }) => void | Promise<void>;
  }) => ReadableStream<unknown>;
} {
  return {
    toUIMessageStream: ({ onEnd }) =>
      new ReadableStream({
        start(controller) {
          const assistantMessage: UIMessage = {
            id: randomUUID(),
            role: "assistant",
            parts: [{ type: "text", text: "E2E_FAKE_LLM: ok" }],
          } as UIMessage;

          void Promise.resolve(
            onEnd?.({
              messages: [assistantMessage],
              isAborted: false,
              finishReason: "stop",
            })
          ).finally(() => {
            controller.close();
          });
        },
      }),
  };
}
