import type { SubscriptionEvent } from "./inference";

/** NDJSON frames can span arbitrary UTF-8/network chunks. Completion must be explicit. */
export async function readSubscriptionStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SubscriptionEvent) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as SubscriptionEvent;
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "completed") completed = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        consume(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
      if (done) break;
    }
    consume(buffer);
    if (!completed) throw new Error("The turn was interrupted. Retry it to continue.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
