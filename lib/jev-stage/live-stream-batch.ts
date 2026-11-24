import type { JevStageTraceEvent } from "./schema";

export type LiveStreamFlush = {
  delta: string;
  traces: JevStageTraceEvent[];
};

/**
 * Coalesce streaming text and trace events into one flush per animation frame
 * so Stage/Insight do not re-render at token rate.
 */
export function createLiveStreamBatch(args: {
  onFlush: (batch: LiveStreamFlush) => void;
  schedule?: (callback: () => void) => number;
  cancel?: (handle: number) => void;
}) {
  const schedule = args.schedule ?? ((callback) => requestAnimationFrame(callback));
  const cancel =
    args.cancel ??
    ((handle) => {
      cancelAnimationFrame(handle);
    });
  let pendingDelta = "";
  let pendingTraces: JevStageTraceEvent[] = [];
  let handle: number | null = null;

  const flush = () => {
    if (handle != null) {
      cancel(handle);
      handle = null;
    }
    if (!pendingDelta && pendingTraces.length === 0) return;
    const batch = { delta: pendingDelta, traces: pendingTraces };

    pendingDelta = "";
    pendingTraces = [];
    args.onFlush(batch);
  };

  const scheduleFlush = () => {
    if (handle != null) return;
    handle = schedule(() => {
      handle = null;
      flush();
    });
  };

  return {
    pushDelta(text: string) {
      if (!text) return;
      pendingDelta += text;
      scheduleFlush();
    },
    pushTrace(event: JevStageTraceEvent) {
      pendingTraces.push(event);
      scheduleFlush();
    },
    flush,
    dispose() {
      if (handle != null) {
        cancel(handle);
        handle = null;
      }
      pendingDelta = "";
      pendingTraces = [];
    },
  };
}
