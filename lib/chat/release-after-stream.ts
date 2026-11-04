/** Drain independently of the client; release only after generation and stream callbacks end. */
export function releaseAfterStream<T>(
  source: ReadableStream<T>,
  release: () => Promise<void>,
  trackCompletion?: (completion: Promise<void>) => void
) {
  let cancelled = false;

  async function drain(controller: ReadableStreamDefaultController<T>) {
    const reader = source.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        if (!cancelled) controller.enqueue(value);
      }
      if (!cancelled) controller.close();
    } catch (error) {
      if (!cancelled) controller.error(error);
    } finally {
      reader.releaseLock();
      await release();
    }
  }

  return new ReadableStream<T>({
    start(controller) {
      const completion = drain(controller);

      // Register synchronously while the route is active. Track cleanup and any queue drain,
      // even after the response closes or the client cancels.
      trackCompletion?.(completion);

      return completion;
    },
    cancel() {
      cancelled = true;
    },
  });
}
