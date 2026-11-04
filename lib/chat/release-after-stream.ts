/** Drain independently of the client; release only after generation and stream callbacks end. */
export function releaseAfterStream<T>(source: ReadableStream<T>, release: () => Promise<void>) {
  let cancelled = false;

  return new ReadableStream<T>({
    async start(controller) {
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
    },
    cancel() {
      cancelled = true;
    },
  });
}
