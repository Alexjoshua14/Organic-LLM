import { chatInputSchema, SubscriptionError } from "./policy";

export async function readSubscriptionInput(request: Request, timeoutMs = 10_000) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new SubscriptionError("Send JSON text messages.", 415);
  const reader = request.body?.getReader();

  if (!reader) throw new SubscriptionError("A message is required.");
  let rejectStop: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    rejectStop = reject;
  });
  const abort = () => rejectStop(new SubscriptionError("Upload was interrupted.", 408));

  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => rejectStop(new SubscriptionError("Upload timed out.", 408)),
    timeoutMs
  );
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    if (request.signal.aborted) abort();
    while (true) {
      const { value, done } = await Promise.race([reader.read(), stopped]);

      if (done) break;
      size += value.length;
      if (size > 300_000) throw new SubscriptionError("This conversation is too large.", 413);
      chunks.push(value);
    }
    try {
      return chatInputSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      throw new SubscriptionError(
        "Send up to 40 alternating text messages, within 64,000 characters."
      );
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
