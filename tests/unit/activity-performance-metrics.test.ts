import { expect, test } from "bun:test";

import { summarizeTimings } from "@/components/agents/activity-performance-metrics";
import { schedulerFixture } from "../helpers/dot-physics-runtime";

test("per-preview costs aggregate independent dots and cover within the same active frame", () => {
  const fixture = schedulerFixture();
  const samples: Parameters<Parameters<typeof fixture.scheduler.subscribeMetrics>[0]>[0][] = [];
  fixture.scheduler.subscribeMetrics((sample) => samples.push(sample));
  fixture.scheduler.register(() => fixture.cost(0.2), "idle-auto");
  fixture.scheduler.register(() => fixture.cost(0.3), "idle-auto");
  fixture.scheduler.register(() => fixture.cost(0.8), "working-auto");
  fixture.scheduler.register(() => fixture.cost(0.1));
  fixture.frame(16);
  expect(samples).toHaveLength(1);
  expect(samples[0]!.frameMs).toBe(16);
  expect(samples[0]!.updateMs).toBeCloseTo(1.4);
  expect(samples[0]!.groups.map((group) => group.id)).toEqual(["idle-auto", "working-auto"]);
  expect(samples[0]!.groups[0]!.updateMs).toBeCloseTo(0.5);
  expect(samples[0]!.groups[0]!.updates).toBe(2);
  expect(samples[0]!.groups[1]!.updateMs).toBeCloseTo(0.8);
});

test("removing the profiler stops telemetry; diagnostics failures do not break animation", () => {
  const fixture = schedulerFixture();
  let frames = 0;
  let samples = 0;
  fixture.scheduler.register(() => {
    frames++;
  });
  const remove = fixture.scheduler.subscribeMetrics(() => {
    samples++;
  });
  fixture.scheduler.subscribeMetrics(() => {
    throw new Error("diagnostics unavailable");
  });
  fixture.frame(16);
  expect(fixture.scheduler.failure).toBeNull();
  remove();
  fixture.frame(16);
  expect(samples).toBe(1);
  expect(frames).toBe(2);
});

test("timing summaries retain missing data and use measured mean and nearest-rank p95", () => {
  expect(summarizeTimings([])).toBeNull();
  const values = Array.from({ length: 100 }, (_, index) => 100 - index);
  expect(summarizeTimings(values)).toEqual({ mean: 50.5, p95: 95, count: 100 });
  expect(values[0]).toBe(100);
  expect(summarizeTimings([0])).toEqual({ mean: 0, p95: 0, count: 1 });
});
