import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FrameLoop } from "./frameLoop";

describe("FrameLoop", () => {
  let rafCbs: FrameRequestCallback[] = [];
  let nowMs: number;

  beforeEach(() => {
    rafCbs = [];
    nowMs = 1000;

    vi.stubGlobal("performance", {
      now: () => nowMs,
    } as Performance);

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafCbs.push(cb);
        return rafCbs.length;
      })
    );

    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("first tick uses dt 0 because loop is seeded with the same timestamp", () => {
    const tick = vi.fn();
    const loop = new FrameLoop(tick);
    loop.start();

    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenLastCalledWith({ deltaTime: 0 });
  });

  it("passes elapsed ms between rAF fires as deltaTime", () => {
    const tick = vi.fn();
    const loop = new FrameLoop(tick);
    loop.start();
    tick.mockClear();

    nowMs = 1016;
    const cb = rafCbs[rafCbs.length - 1];
    cb(nowMs);

    expect(tick).toHaveBeenCalledWith({ deltaTime: 16 });
  });

  it("clamps deltaTime to 100ms", () => {
    const tick = vi.fn();
    const loop = new FrameLoop(tick);
    loop.start();
    tick.mockClear();

    nowMs = 10_000;
    const cb = rafCbs[rafCbs.length - 1];
    cb(nowMs);

    expect(tick).toHaveBeenCalledWith({ deltaTime: 100 });
  });

  it("stop calls cancelAnimationFrame and prevents further ticks when cb runs", () => {
    const tick = vi.fn();
    const loop = new FrameLoop(tick);
    loop.start();
    const cancel = globalThis.cancelAnimationFrame as ReturnType<typeof vi.fn>;
    tick.mockClear();

    loop.stop();
    expect(cancel).toHaveBeenCalled();

    const len = rafCbs.length;
    nowMs = 2000;
    rafCbs[len - 1](nowMs);

    expect(tick).not.toHaveBeenCalled();
  });

  it("start is idempotent while already running", () => {
    const tick = vi.fn();
    const loop = new FrameLoop(tick);
    const raf = globalThis.requestAnimationFrame as ReturnType<typeof vi.fn>;
    loop.start();
    const n = raf.mock.calls.length;
    loop.start();
    expect(raf.mock.calls.length).toBe(n);
  });
});
