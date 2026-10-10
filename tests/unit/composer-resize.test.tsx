import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { StrictMode, useRef } from "react";

import { useMorphFlip } from "@/hooks/use-morph-flip";
import { COMPOSER_SHIFT_MIN_PX, COMPOSER_SHIFT_SPRING } from "@/lib/chat/composer-shift-spring";
import { render } from "../helpers/render";

type Box = { left: number; bottom: number; width: number; height: number };
let layout: Box;
let time: number;
let frameId: number;
const frames = new Map<number, FrameRequestCallback>();
const observers: Array<{ emit: () => void; disconnected: boolean }> = [];
let rectSpy: ReturnType<typeof spyOn<typeof HTMLElement.prototype, "getBoundingClientRect">>;
let timeSpy: ReturnType<typeof spyOn<typeof performance, "now">>;
let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;
let originalObserver: typeof ResizeObserver;

function visibleBox(el: HTMLElement): Box {
  const translation = el.style.transform.match(/translate3d\(([^p]+)px, ([^p]+)px/);
  const scale = Number(el.style.transform.match(/scaleX\(([^)]+)\)/)?.[1] ?? 1);

  return {
    ...layout,
    left: layout.left + Number(translation?.[1] ?? 0),
    bottom: layout.bottom + Number(translation?.[2] ?? 0),
    width: layout.width * scale,
  };
}

function Composer({ mode = "wide", disabled = false }: { mode?: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useMorphFlip(ref, mode, {
    spring: COMPOSER_SHIFT_SPRING,
    minShiftPx: COMPOSER_SHIFT_MIN_PX,
    disabled,
  });

  return (
    <div ref={ref} data-testid="composer">
      <textarea defaultValue="Unsent draft" />
    </div>
  );
}

function paint(ms = 16) {
  act(() => {
    time += ms;
    const pending = [...frames.entries()];

    for (const [id, callback] of pending) {
      frames.delete(id);
      callback(time);
    }
  });
}

function settle() {
  for (let i = 0; i < 60 && frames.size; i += 1) paint();
}

beforeEach(() => {
  layout = { left: 300, bottom: 800, width: 800, height: 120 };
  time = 0;
  frameId = 0;
  frames.clear();
  observers.length = 0;
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  originalObserver = globalThis.ResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  globalThis.ResizeObserver = class implements ResizeObserver {
    entry: { emit: () => void; disconnected: boolean };
    constructor(callback: ResizeObserverCallback) {
      this.entry = { emit: () => callback([], this), disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      this.entry.disconnected = true;
    }
  };
  timeSpy = spyOn(performance, "now").mockImplementation(() => time);
  rectSpy = spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const box = visibleBox(this);

    return {
      x: box.left,
      y: box.bottom - box.height,
      left: box.left,
      top: box.bottom - box.height,
      right: box.left + box.width,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
      toJSON: () => box,
    };
  });
});

afterEach(() => {
  cleanup();
  rectSpy.mockRestore();
  timeSpy.mockRestore();
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  globalThis.ResizeObserver = originalObserver;
});

describe("composer viewport transitions", () => {
  test("a snapped window resize preserves the visible width and anchor, then settles without remounting", () => {
    const view = render(<Composer />);
    const el = view.getByTestId("composer");
    const input = view.getByRole("textbox") as HTMLTextAreaElement;
    const before = visibleBox(el);

    input.focus();
    layout = { left: 16, bottom: 720, width: 600, height: 120 };
    act(() => window.dispatchEvent(new Event("resize")));
    expect(visibleBox(el)).toEqual(before);
    paint();
    expect(visibleBox(el).width).toBeLessThan(before.width);
    expect(visibleBox(el).width).toBeGreaterThan(layout.width);
    settle();
    expect(el.style.transform).toBe("");
    expect(el.style.willChange).toBe("");
    expect(visibleBox(el)).toEqual(layout);
    expect(view.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Unsent draft");
  });

  test("resize observation before the breakpoint commit and a reverse resize both retarget continuously", () => {
    const view = render(<Composer />);
    const el = view.getByTestId("composer");
    const initial = visibleBox(el);

    layout = { ...layout, left: 16, width: 600 };
    act(() => observers[0]!.emit());
    expect(visibleBox(el)).toEqual(initial);
    layout = { ...layout, bottom: 760 };
    view.rerender(<Composer mode="condensed" />);
    expect(visibleBox(el)).toEqual(initial);
    paint();
    paint();
    const midway = visibleBox(el);

    layout = { ...layout, left: 280, bottom: 800, width: 820 };
    act(() => window.dispatchEvent(new Event("resize")));
    view.rerender(<Composer mode="wide" />);
    expect(visibleBox(el).left).toBeCloseTo(midway.left, 6);
    expect(visibleBox(el).bottom).toBeCloseTo(midway.bottom, 6);
    expect(visibleBox(el).width).toBeCloseTo(midway.width, 6);
    expect(frames.size).toBe(1);
    settle();
    expect(el.style.transform).toBe("");
    expect(visibleBox(el)).toEqual(layout);
  });

  test("typing does not animate height, and reduced motion immediately stops an active spring", () => {
    const view = render(<Composer />);
    const el = view.getByTestId("composer");

    layout = { ...layout, height: 240 };
    act(() => observers[0]!.emit());
    expect(frames.size).toBe(0);
    layout = { ...layout, width: 600 };
    act(() => window.dispatchEvent(new Event("resize")));
    expect(frames.size).toBe(1);
    view.rerender(<Composer disabled />);
    expect(el.style.transform).toBe("");
    expect(frames.size).toBe(0);
    layout = { ...layout, width: 800 };
    act(() => window.dispatchEvent(new Event("resize")));
    expect(el.style.transform).toBe("");
    expect(frames.size).toBe(0);
  });

  test("Strict Mode and unmount release observers and animation frames", () => {
    const view = render(
      <StrictMode>
        <Composer />
      </StrictMode>
    );

    expect(observers[0]!.disconnected).toBe(true);
    layout = { ...layout, width: 600 };
    act(() => window.dispatchEvent(new Event("resize")));
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });
});
