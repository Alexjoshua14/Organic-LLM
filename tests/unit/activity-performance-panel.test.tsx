import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, within } from "@testing-library/react";

import { ActivityPerformancePanel } from "@/app/sandbox/prototypes/organic-agent/_components/activity-performance-panel";
import { schedulerFixture } from "../helpers/dot-physics-runtime";
import { render } from "../helpers/render";

const originals = [
  Object.getOwnPropertyDescriptor(window, "requestAnimationFrame"),
  Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame"),
  Object.getOwnPropertyDescriptor(document, "hidden"),
];
let requests: Map<number, FrameRequestCallback>;
let time: number;
let hidden = false;
const variants = [
  { id: "idle-auto", label: "Idle" },
  { id: "working-v0", label: "Working v0" },
];

beforeEach(() => {
  requests = new Map();
  hidden = false;
  let id = 0;
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      requests.set(++id, callback);
      return id;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: (key: number) => requests.delete(key),
  });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  time = performance.now();
});

afterEach(() => {
  cleanup();
  [
    [window, "requestAnimationFrame"],
    [window, "cancelAnimationFrame"],
    [document, "hidden"],
  ].forEach(([object, key], index) => {
    const original = originals[index];
    if (original) Object.defineProperty(object, key as string, original);
    else Reflect.deleteProperty(object, key as string);
  });
});

function previewRef() {
  const element = document.createElement("section");
  element.innerHTML =
    '<div data-performance-preview="idle-auto"><svg data-dot-renderer="physics"></svg></div><div data-performance-preview="working-v0"><svg data-dot-renderer="v0"></svg></div>';
  return { current: element };
}

function monitorFrame(delta = 1000 / 60) {
  time += delta;
  const callbacks = [...requests.entries()];
  callbacks.forEach(([id, callback]) => {
    requests.delete(id);
    callback(time);
  });
}

test("actual scheduler samples reach the compact graphs/table and native animation remains explicitly unmeasured", async () => {
  const fixture = schedulerFixture();
  fixture.scheduler.register(() => fixture.cost(0.2), "idle-auto");
  fixture.scheduler.register(() => fixture.cost(0.3), "idle-auto");
  const view = render(
    <ActivityPerformancePanel
      previewRef={previewRef()}
      variants={variants}
      scheduler={fixture.scheduler}
    />
  );
  time = performance.now();
  await act(async () => {
    for (let frame = 0; frame < 35; frame++) {
      fixture.frame(1000 / 60);
      monitorFrame();
    }
  });
  expect(view.getAllByRole("img")).toHaveLength(4);
  expect(view.getByText("3.0")).toBeTruthy(); // 0.5ms / 16.67ms at the default 60fps.
  fireEvent.change(view.getByRole("combobox", { name: "Target frame rate" }), {
    target: { value: "120" },
  });
  expect(view.getByText("6.0")).toBeTruthy();
  expect(view.getByText("8.33ms/frame")).toBeTruthy();
  expect(view.getByText("60.0")).toBeTruthy();
  const rows = view.getAllByRole("row");
  expect(within(rows[1]!).getAllByText("0.500")).toHaveLength(2);
  expect(within(rows[1]!).getByText("Physics")).toBeTruthy();
  expect(within(rows[2]!).getByText("Original v0")).toBeTruthy();
  expect(within(rows[2]!).getByText("Unmeasured")).toBeTruthy();
  expect(within(rows[2]!).queryByText("0.000")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Pause" }));
  expect(requests.size).toBe(0);
  expect(fixture.frames.size).toBe(1); // Pausing diagnostics leaves the animation itself running.
  fireEvent.click(view.getByRole("button", { name: "Clear" }));
  expect(within(view.getAllByRole("row")[1]!).queryByText("0.500")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Resume" }));
  expect(requests.size).toBe(1);
  view.unmount();
  expect(requests.size).toBe(0);
});

test("hidden-tab time is excluded from frame cadence instead of being reported as animation jank", async () => {
  const fixture = schedulerFixture();
  const view = render(
    <ActivityPerformancePanel
      previewRef={previewRef()}
      variants={variants}
      scheduler={fixture.scheduler}
    />
  );
  time = performance.now();
  await act(async () => {
    for (let frame = 0; frame < 35; frame++) monitorFrame();
  });
  expect(view.getByText("60.0")).toBeTruthy();
  hidden = true;
  document.dispatchEvent(new window.Event("visibilitychange"));
  expect(requests.size).toBe(0);
  time += 10000;
  hidden = false;
  document.dispatchEvent(new window.Event("visibilitychange"));
  await act(async () => {
    for (let frame = 0; frame < 40; frame++) monitorFrame();
  });
  expect(view.getByText("60.0")).toBeTruthy();
  expect(view.getByText("16.667")).toBeTruthy();
});

test("frame p95 uses raw intervals including missed frames, with exact nearest-rank counts", async () => {
  const fixture = schedulerFixture();
  const view = render(
    <ActivityPerformancePanel
      previewRef={previewRef()}
      variants={variants}
      scheduler={fixture.scheduler}
    />
  );
  time = performance.now();
  await act(async () => {
    monitorFrame(0); // Establish the first timestamp without inventing an interval.
    for (let frame = 0; frame < 25; frame++) monitorFrame(16);
    monitorFrame(50);
    monitorFrame(50); // 27 raw intervals; nearest rank ceil(27*.95)=26, so p95=50ms.
  });
  expect(view.getByText("50.000")).toBeTruthy();
  expect(view.getByText("Frame p95: 27 raw intervals · 0.500s observed")).toBeTruthy();
  expect(view.getByText("54.0")).toBeTruthy(); // 1000 / (500/27); not a fixed 60fps assumption.
});

test("120Hz frame intervals retain their measured precision independently of the target FPS", async () => {
  const fixture = schedulerFixture();
  const view = render(
    <ActivityPerformancePanel
      previewRef={previewRef()}
      variants={variants}
      scheduler={fixture.scheduler}
    />
  );
  time = performance.now();
  await act(async () => {
    for (let frame = 0; frame < 65; frame++) monitorFrame(1000 / 120);
  });
  expect(view.getByText("8.333")).toBeTruthy();
  expect(view.getByText("120.0")).toBeTruthy();
  expect(
    (view.getByRole("combobox", { name: "Target frame rate" }) as HTMLSelectElement).value
  ).toBe("60");
});
