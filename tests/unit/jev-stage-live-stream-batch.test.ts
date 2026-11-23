import { describe, expect, test } from "bun:test";

import { createLiveStreamBatch } from "@/lib/jev-stage/live-stream-batch";
import type { JevStageTraceEvent } from "@/lib/jev-stage/schema";

describe("createLiveStreamBatch", () => {
  test("coalesces deltas and traces into one scheduled flush", () => {
    const flushes: { delta: string; traces: JevStageTraceEvent[] }[] = [];
    let scheduled: (() => void) | null = null;
    const batch = createLiveStreamBatch({
      onFlush: (flush) => flushes.push(flush),
      schedule: (callback) => {
        scheduled = callback;
        return 1;
      },
      cancel: () => {
        scheduled = null;
      },
    });
    const start: JevStageTraceEvent = { kind: "jev.start", t: 0 };

    batch.pushDelta("Hel");
    batch.pushDelta("lo");
    batch.pushTrace(start);
    expect(flushes).toEqual([]);
    expect(scheduled).not.toBeNull();
    scheduled!();
    expect(flushes).toEqual([{ delta: "Hello", traces: [start] }]);
  });

  test("flush drains immediately and dispose drops pending work", () => {
    const flushes: { delta: string; traces: JevStageTraceEvent[] }[] = [];
    let scheduled: (() => void) | null = null;
    const batch = createLiveStreamBatch({
      onFlush: (flush) => flushes.push(flush),
      schedule: (callback) => {
        scheduled = callback;
        return 7;
      },
      cancel: () => {
        scheduled = null;
      },
    });

    batch.pushDelta("a");
    batch.flush();
    expect(flushes).toEqual([{ delta: "a", traces: [] }]);
    expect(scheduled).toBeNull();

    batch.pushDelta("b");
    batch.dispose();
    expect(scheduled).toBeNull();
    batch.flush();
    expect(flushes).toEqual([{ delta: "a", traces: [] }]);
  });
});
