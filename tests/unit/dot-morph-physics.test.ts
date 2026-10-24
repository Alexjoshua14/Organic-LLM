import { expect, test } from "bun:test";

import { DotMorphPhysics } from "@/components/agents/dot-morph-physics";
import { dotOpacity, dotRestScale } from "@/components/agents/agent-dot-grid-motion";
import { DotFrameHealth } from "@/components/agents/dot-physics-scheduler";
import { schedulerFixture } from "../helpers/dot-physics-runtime";

test("independent custom physics instances stay finite and bounded across states and frame rates", () => {
  for (const state of ["idle", "working", "waiting", "blocked", "complete"] as const) {
    for (const dt of [1000 / 120, 1000 / 60, 1000 / 30, 250]) {
      const dots = Array.from({ length: 18 }, (_, index) => {
        const dot = new DotMorphPhysics(dotRestScale(index, "Lyra"), index);
        dot.setState(state);
        return dot;
      });
      for (let frame = 0; frame < 180; frame++) {
        for (const dot of dots) {
          const pose = dot.step(dt);
          expect(Object.values(pose).every(Number.isFinite)).toBe(true);
          expect(pose.scale).toBeGreaterThanOrEqual(0.65);
          expect(pose.scale).toBeLessThanOrEqual(1.35);
          expect(Math.abs(pose.x)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(pose.y)).toBeLessThanOrEqual(0.5);
          expect(dotOpacity(pose.scale)).toBeGreaterThanOrEqual(0.4);
          expect(dotOpacity(pose.scale)).toBeLessThanOrEqual(0.95);
        }
      }
      if (state === "complete") expect(dots.every((dot) => dot.complete)).toBe(true);
    }
  }
});

test("retargeting keeps momentum and completion settles once into each soft resting size", () => {
  const rest = dotRestScale(0, "Lyra");
  const dot = new DotMorphPhysics(rest, 0, () => 1);
  for (let frame = 0; frame < 20; frame++) dot.step(1000 / 60);
  const before = { ...dot.current };
  dot.setState("working");
  expect(dot.current).toEqual(before);
  const after = { ...dot.step(1000 / 60) };
  expect(Math.abs(after.scale - before.scale)).toBeLessThan(0.02);
  dot.setState("complete");
  for (let frame = 0; frame < 180; frame++) dot.step(1000 / 60);
  expect(dot.complete).toBe(true);
  expect(dot.current).toEqual({ x: 0, y: 0, scale: rest });
  const completed = { ...dot.current };
  dot.step(1000 / 60);
  expect(dot.current).toEqual(completed);
  dot.setState("working");
  expect(dot.complete).toBe(false);
  expect(() => dot.morphTo({ x: NaN, y: 0, scale: 1 })).toThrow();
  for (const invalid of [0, -1, NaN, Infinity]) expect(() => dot.step(invalid)).toThrow();
});

test("frame health ignores warmup and short stalls, then detects sustained FPS or update-cost pressure", () => {
  const sample = (guard: DotFrameHealth, frames: number, dt: number, cost = 0) => {
    let failure: ReturnType<DotFrameHealth["sample"]> = null;
    for (let frame = 0; frame < frames; frame++) failure ||= guard.sample(dt, cost);
    return failure;
  };
  const healthy = new DotFrameHealth();
  expect(sample(healthy, 1000, 1000 / 60, 0.1)).toBeNull();
  expect(healthy.sample(200, 0.1)).toBeNull();
  expect(sample(healthy, 200, 1000 / 60, 0.1)).toBeNull();
  const slow = new DotFrameHealth();
  expect(sample(slow, 15, 50)).toBeNull(); // Warmup.
  expect(sample(slow, 40, 50)).toBeNull(); // Only one poor window.
  expect(sample(slow, 40, 50)).toBe("frame-rate");
  expect(sample(new DotFrameHealth(), 300, 1000 / 60, 5)).toBe("update-cost");
  expect(new DotFrameHealth().sample(NaN, 0)).toBe("engine-error");
  expect(new DotFrameHealth().sample(16, Infinity)).toBe("engine-error");
});

test("all dots share one frame, hidden time is excluded, and the last cleanup stops the loop", () => {
  const fixture = schedulerFixture();
  let ticks = 0;
  const remove = Array.from({ length: 90 }, () =>
    fixture.scheduler.register(() => {
      ticks++;
    })
  );
  expect(fixture.frames.size).toBe(1);
  fixture.frame(1000 / 60);
  expect(ticks).toBe(90);
  expect(fixture.frames.size).toBe(1);
  fixture.hide(true);
  expect(fixture.frames.size).toBe(0);
  fixture.cost(60_000);
  fixture.hide(false);
  fixture.frame(1000 / 60);
  expect(fixture.scheduler.failure).toBeNull();
  remove.forEach((cleanup) => cleanup());
  expect(fixture.frames.size).toBe(0);
});

test("performance and engine failures stop work and latch fallback for current and later subscribers", () => {
  for (const mode of ["slow", "expensive", "error"] as const) {
    const fixture = schedulerFixture();
    let failures = 0;
    fixture.scheduler.subscribeFailure(() => failures++);
    fixture.scheduler.register(() => {
      if (mode === "error") throw new Error("renderer failed");
      if (mode === "expensive") fixture.cost(5);
    });
    for (let frame = 0; frame < 400 && fixture.frames.size; frame++)
      fixture.frame(mode === "slow" ? 50 : 1000 / 60);
    expect(fixture.scheduler.failure).toBe(
      mode === "slow" ? "frame-rate" : mode === "expensive" ? "update-cost" : "engine-error"
    );
    expect(failures).toBe(1);
    expect(fixture.frames.size).toBe(0);
    fixture.scheduler.subscribeFailure(() => failures++);
    expect(failures).toBe(2);
    fixture.scheduler.register(() => {});
    expect(fixture.frames.size).toBe(0);
  }
});
