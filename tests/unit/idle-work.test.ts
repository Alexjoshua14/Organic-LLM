import { afterEach, describe, expect, test } from "bun:test";

import { IDLE_WORK_FALLBACK_GAP_MS, IDLE_WORK_TIMEOUT_MS, runInIdleSlices } from "@/lib/idle-work";
import { ensureDom } from "../helpers/render";

ensureDom();

const idleQueue = new Map<number, IdleRequestCallback>();
const idleOptions: Array<IdleRequestOptions | undefined> = [];
let nextHandle = 1;

function installManualIdle() {
  window.requestIdleCallback = ((callback: IdleRequestCallback, options?: IdleRequestOptions) => {
    const handle = nextHandle++;

    idleQueue.set(handle, callback);
    idleOptions.push(options);

    return handle;
  }) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = (handle: number) => {
    idleQueue.delete(handle);
  };
}

/** Runs the queued slices once, each given `timeRemaining` ms of idle time. */
function flushIdle(timeRemaining: number): number {
  const callbacks = [...idleQueue.values()];

  idleQueue.clear();
  for (const callback of callbacks)
    callback({ didTimeout: false, timeRemaining: () => timeRemaining });

  return callbacks.length;
}

/** A task with `units` steps that does as many per slice as it is allowed. */
function unitTask(units: number) {
  const state = { done: 0 };
  const task = (hasTimeLeft: () => boolean) => {
    while (state.done < units && hasTimeLeft()) state.done++;

    return state.done === units;
  };

  return { state, task };
}

afterEach(() => {
  idleQueue.clear();
  idleOptions.length = 0;
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

describe("runInIdleSlices", () => {
  test("waits for idle, then makes progress every slice even with no time left", () => {
    installManualIdle();
    const { state, task } = unitTask(3);

    runInIdleSlices(task);

    expect(state.done).toBe(0);
    expect(idleOptions[0]).toEqual({ timeout: IDLE_WORK_TIMEOUT_MS });

    expect(flushIdle(0)).toBe(1);
    expect(state.done).toBe(1);
    flushIdle(0);
    flushIdle(0);
    expect(state.done).toBe(3);
    expect(idleQueue.size).toBe(0);
  });

  test("uses the idle time it is given", () => {
    installManualIdle();
    const { state, task } = unitTask(5);

    runInIdleSlices(task);
    flushIdle(20);

    expect(state.done).toBe(5);
    expect(idleQueue.size).toBe(0);
  });

  test("cancel drops the pending slice", () => {
    installManualIdle();
    const { state, task } = unitTask(3);
    const cancel = runInIdleSlices(task);

    flushIdle(0);
    cancel();

    expect(flushIdle(0)).toBe(0);
    expect(state.done).toBe(1);
  });

  test("falls back to timers without requestIdleCallback", async () => {
    const { state, task } = unitTask(2);

    runInIdleSlices(task);
    expect(state.done).toBe(0);

    await Bun.sleep(IDLE_WORK_FALLBACK_GAP_MS + 30);

    expect(state.done).toBe(2);
  });
});
