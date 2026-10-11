export type DotPhysicsFailure = "frame-rate" | "update-cost" | "engine-error";
export type ActivityFrameSample = {
  frameMs: number;
  updateMs: number;
  groups: { id: string; updateMs: number; updates: number }[];
};

const WARMUP_MS = 750;
const SAMPLE_WINDOW_MS = 2000;
const MIN_FPS = 30;
const MAX_UPDATE_MS = 4;
const BAD_WINDOWS = 2;

/** Visible frames only; a brief load/resize stall does not latch the fallback. */
export class DotFrameHealth {
  private age = 0;
  private elapsed = 0;
  private frames = 0;
  private cost = 0;
  private badWindows = 0;

  sample(deltaTime: number, updateCost: number): DotPhysicsFailure | null {
    if (
      !Number.isFinite(deltaTime) ||
      !Number.isFinite(updateCost) ||
      deltaTime < 0 ||
      updateCost < 0
    )
      return "engine-error";
    this.age += deltaTime;
    if (this.age <= WARMUP_MS) return null;
    this.elapsed += deltaTime;
    this.frames++;
    this.cost += updateCost;
    if (this.elapsed < SAMPLE_WINDOW_MS) return null;

    const failure =
      (this.frames * 1000) / this.elapsed < MIN_FPS
        ? "frame-rate"
        : this.cost / this.frames > MAX_UPDATE_MS
          ? "update-cost"
          : null;

    this.badWindows = failure ? this.badWindows + 1 : 0;
    this.elapsed = this.frames = this.cost = 0;

    return this.badWindows >= BAD_WINDOWS ? failure : null;
  }
}

type SchedulerRuntime = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  now: () => number;
  hidden: () => boolean;
  onVisibility: (callback: () => void) => () => void;
};

/** Dot and glass instances share one page-level frame callback and health budget. */
export class DotPhysicsScheduler {
  failure: DotPhysicsFailure | null = null;
  private ticks = new Map<(deltaTime: number) => void, string | undefined>();
  private listeners = new Set<() => void>();
  private metrics = new Set<(sample: ActivityFrameSample) => void>();
  private frame: number | null = null;
  private lastTime = 0;
  private health = new DotFrameHealth();
  private removeVisibility: (() => void) | null = null;

  constructor(private runtime: SchedulerRuntime) {}

  subscribeFailure(callback: () => void): () => void {
    this.listeners.add(callback);
    if (this.failure) callback();

    return () => {
      this.listeners.delete(callback);
    };
  }

  /** Opt-in lab telemetry; production frames do not time each individual instance. */
  subscribeMetrics(callback: (sample: ActivityFrameSample) => void): () => void {
    this.metrics.add(callback);

    return () => {
      this.metrics.delete(callback);
    };
  }

  register(tick: (deltaTime: number) => void, performanceId?: string): () => void {
    if (this.failure) return () => {};
    this.ticks.set(tick, performanceId);
    if (!this.removeVisibility) this.removeVisibility = this.runtime.onVisibility(this.visibility);
    this.start();

    return () => {
      this.ticks.delete(tick);
      if (!this.ticks.size) {
        this.stop();
        this.removeVisibility?.();
        this.removeVisibility = null;
      }
    };
  }

  private start() {
    if (this.frame !== null || this.failure || this.runtime.hidden() || !this.ticks.size) return;
    this.lastTime = this.runtime.now();
    this.health = new DotFrameHealth();
    try {
      this.frame = this.runtime.requestFrame(this.tick);
    } catch {
      this.fail("engine-error");
    }
  }

  private stop() {
    if (this.frame !== null) this.runtime.cancelFrame(this.frame);
    this.frame = null;
  }

  private visibility = () => {
    if (this.runtime.hidden()) this.stop();
    else this.start();
  };

  private fail(reason: DotPhysicsFailure) {
    this.failure = reason;
    this.stop();
    this.ticks.clear();
    this.removeVisibility?.();
    this.removeVisibility = null;
    this.listeners.forEach((notify) => notify());
  }

  private tick = (time: number) => {
    this.frame = null;
    if (this.failure || this.runtime.hidden() || !this.ticks.size) return;
    const dt = time - this.lastTime;

    this.lastTime = time;
    const start = this.runtime.now();

    try {
      if (!Number.isFinite(dt) || !Number.isFinite(start)) throw new Error("Invalid physics clock");
      const groups = this.metrics.size
        ? new Map<string, { id: string; updateMs: number; updates: number }>()
        : null;

      if (dt > 0)
        this.ticks.forEach((id, tick) => {
          const before = groups && id ? this.runtime.now() : 0;

          tick(dt);
          if (groups && id) {
            const group = groups.get(id) ?? { id, updateMs: 0, updates: 0 };

            group.updateMs += Math.max(0, this.runtime.now() - before);
            group.updates++;
            groups.set(id, group);
          }
        });
      const updateMs = this.runtime.now() - start;
      const failure = dt > 0 ? this.health.sample(dt, updateMs) : null;

      if (failure) this.fail(failure);
      if (groups && dt > 0) {
        const sample = { frameMs: dt, updateMs, groups: [...groups.values()] };

        this.metrics.forEach((listener) => {
          // A diagnostics view must never break the actual animation engine.
          try {
            listener(sample);
          } catch {
            this.metrics.delete(listener);
          }
        });
      }
      if (!this.failure && this.ticks.size) this.frame = this.runtime.requestFrame(this.tick);
    } catch {
      this.fail("engine-error");
    }
  };
}

export const dotPhysicsScheduler = new DotPhysicsScheduler({
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
  hidden: () => document.hidden,
  onVisibility: (callback) => {
    document.addEventListener("visibilitychange", callback);

    return () => document.removeEventListener("visibilitychange", callback);
  },
});
