import type { UIMessage } from "ai";

type ToUIMessageStreamArgs = {
  onFinish?: (args: {
    messages: UIMessage[];
    isAborted: boolean;
    finishReason?: string;
  }) => void | Promise<void>;
  onError?: (error: unknown) => string;
};

type StreamTextCall = {
  model: string;
  messages: unknown[];
  system?: string;
  tools?: Record<string, unknown>;
};

/**
 * Fake `streamText()` that never calls a real provider.
 *
 * It returns an object that matches only the surface area your Aion route uses:
 * - `result.toUIMessageStream({ onFinish, onError })`
 *
 * When the returned stream is consumed, it optionally calls `onFinish()` with
 * `onFinishMessages`, then ends immediately.
 */
export function createMockStreamText(options?: {
  onFinishMessages?: UIMessage[];
  finishReason?: string;
  isAborted?: boolean;
  throwInStreamText?: boolean;
}): {
  streamText: (call: StreamTextCall) => {
    toUIMessageStream: (args: ToUIMessageStreamArgs) => ReadableStream<unknown>;
  };
  calls: StreamTextCall[];
} {
  const calls: StreamTextCall[] = [];

  const streamText = (call: StreamTextCall) => {
    calls.push(call);

    if (options?.throwInStreamText) {
      throw new Error("mock streamText error");
    }

    return {
      toUIMessageStream: ({ onFinish }: ToUIMessageStreamArgs) => {
        return new ReadableStream({
          start(controller) {
            const finish = async () => {
              if (onFinish) {
                await onFinish({
                  messages: options?.onFinishMessages ?? [],
                  isAborted: options?.isAborted ?? false,
                  finishReason: options?.finishReason ?? "stop",
                });
              }
            };

            void finish()
              .catch(() => {
                // If the route provides onError, it will handle it.
              })
              .finally(() => {
                controller.close();
              });
          },
        });
      },
    };
  };

  return { streamText, calls };
}

