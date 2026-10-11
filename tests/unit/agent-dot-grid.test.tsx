import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { AgentDotGrid } from "@/components/agents/agent-dot-grid";
import {
  AGENT_DOTS,
  createDotAnimation,
  dotOpacity,
  dotRestScale,
} from "@/components/agents/agent-dot-grid-motion";
import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { SubagentIdentityMark } from "@/components/agents/subagent-identity-mark";
import { createSubagentActivitySeed } from "@/lib/arcadia/multitask/activity-seed";
import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import { render } from "../helpers/render";

type RecordedAnimation = {
  frames: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: Animation;
};
const calls: RecordedAnimation[] = [];
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
const originalMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");
const originalRaf = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
let reduced = false;
let mediaEvents: EventTarget;
let intersection: IntersectionObserverCallback;
let disconnect: ReturnType<typeof mock>;

beforeEach(() => {
  reduced = false;
  calls.length = 0;
  mediaEvents = new window.EventTarget();
  disconnect = mock(() => {});
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() {
        return reduced;
      },
      addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
      removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
    }),
  });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  });
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: (frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = {
        playState: "running",
        onfinish: null,
        pause: mock(function (this: Animation) {
          Object.assign(this, { playState: "paused" });
        }),
        play: mock(function (this: Animation) {
          Object.assign(this, { playState: "running" });
        }),
        cancel: mock(() => {}),
      } as unknown as Animation;
      calls.push({ frames, options, animation });
      return animation;
    },
  });
});

afterEach(() => {
  cleanup();
  const restore = (object: object, key: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else Reflect.deleteProperty(object, key);
  };
  restore(Element.prototype, "animate", originalAnimate);
  restore(window, "matchMedia", originalMedia);
  restore(globalThis, "IntersectionObserver", originalObserver);
  restore(document, "hidden", originalHidden);
  restore(window, "requestAnimationFrame", originalRaf);
});

test("the SVG has the requested 1/3/5/5/3/1 grid and stable server markup", () => {
  expect(
    Array.from({ length: 6 }, (_, row) => AGENT_DOTS.filter((dot) => dot.y === 5 + row * 6).length)
  ).toEqual([1, 3, 5, 5, 3, 1]);
  const html = renderToString(<AgentDotGrid state="working" />);
  expect(html).toBe(renderToString(<AgentDotGrid state="idle" />));
  expect(html.match(/<circle /g)?.length).toBe(18);
  expect(html.match(/organic-glass-smoke/g)?.length).toBe(18);
});

test("idle/working variance and every emitted size-opacity pair honor the common bounds", () => {
  expect(dotOpacity(1)).toBe(0.75);
  expect(dotOpacity(0.65)).toBeCloseTo(0.4);
  expect(dotOpacity(1.35)).toBeCloseTo(0.95);
  expect(dotOpacity(0)).toBeCloseTo(0.4);
  expect(dotOpacity(9)).toBeCloseTo(0.95);
  for (const state of ["idle", "working", "waiting", "blocked", "complete"] as const) {
    for (const random of [() => 0, () => 0.5, () => 1]) {
      const { frames } = createDotAnimation(
        state,
        0,
        { transform: "scale(1)", opacity: 0.75 },
        1,
        random
      );
      for (const frame of frames) {
        const scale = Number(String(frame.transform).match(/scale\(([^)]+)\)/)?.[1]);
        expect(Number(frame.opacity)).toBeCloseTo(dotOpacity(scale));
        expect(Number(frame.opacity)).toBeGreaterThanOrEqual(0.4);
        expect(Number(frame.opacity)).toBeLessThanOrEqual(0.95);
      }
      // The relationship must hold between targets too, including crossings of baseline size.
      for (let index = 1; index < frames.length; index++) {
        const from = frames[index - 1]!;
        const to = frames[index]!;
        const fromScale = Number(String(from.transform).match(/scale\(([^)]+)\)/)?.[1]);
        const toScale = Number(String(to.transform).match(/scale\(([^)]+)\)/)?.[1]);
        for (const progress of [0.25, 0.5, 0.75]) {
          const size = fromScale + (toScale - fromScale) * progress;
          const opacity =
            Number(from.opacity) + (Number(to.opacity) - Number(from.opacity)) * progress;
          expect(opacity).toBeCloseTo(dotOpacity(size));
        }
      }
      if (state === "idle") {
        for (const frame of frames.slice(1, -1)) {
          const scale = Number(String(frame.transform).match(/scale\(([^)]+)\)/)?.[1]);
          if (scale === 1) continue;
          expect(Math.abs(scale - 1)).toBeGreaterThanOrEqual(0.049999);
          expect(Math.abs(scale - 1)).toBeLessThanOrEqual(0.150001);
        }
      }
    }
  }
});

test("offscreen and backgrounded dots pause; visible dots resume and unmount cancels", () => {
  const view = render(<AgentDotGrid />);
  expect(calls).toHaveLength(18);
  expect(calls[0]!.animation.pause).toHaveBeenCalled();
  intersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  expect(calls[0]!.animation.play).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  document.dispatchEvent(new window.Event("visibilitychange"));
  expect(calls[0]!.animation.playState).toBe("paused");
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.dispatchEvent(new window.Event("visibilitychange"));
  expect(calls[0]!.animation.playState).toBe("running");
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  for (const { animation } of calls) {
    expect(animation.cancel).toHaveBeenCalled();
    expect(animation.onfinish).toBeNull();
  }
});

test("new cycles resample jitter, while complete settles once and state changes keep the current frame", () => {
  const view = render(<AgentDotGrid />);
  const resting = calls.map(({ frames }) => frames[0]!);
  const finish = calls[0]!.animation.onfinish!;
  finish.call(calls[0]!.animation, {} as AnimationPlaybackEvent);
  expect(calls).toHaveLength(19);
  const dot = view.container.querySelectorAll("g > g")[0] as SVGGElement;
  dot.style.transform = "scale(1.1)";
  dot.style.opacity = String(dotOpacity(1.1));
  view.rerender(<AgentDotGrid state="complete" />);
  const completion = calls.slice(19);
  expect(completion).toHaveLength(18);
  expect(completion[0]!.frames[0]!.transform).toBe("scale(1.1)");
  expect(completion[0]!.frames[0]!.opacity).toBeCloseTo(dotOpacity(1.1));
  for (const [index, { animation, frames, options }] of completion.entries()) {
    expect(animation.onfinish).toBeNull();
    expect(options.iterations).toBe(1);
    expect(frames.at(-1)?.transform).toBe(resting[index]!.transform);
    expect(frames.at(-1)?.opacity).toBe(resting[index]!.opacity);
    Object.assign(animation, { playState: "finished" });
  }
  const pauseCount = (completion[0]!.animation.pause as ReturnType<typeof mock>).mock.calls.length;
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  document.dispatchEvent(new window.Event("visibilitychange"));
  expect(completion[0]!.animation.pause).toHaveBeenCalledTimes(pauseCount);
});

test("reduced motion is static initially and reacts when the preference changes", async () => {
  reduced = true;
  const view = render(<AgentDotGrid state="working" />);
  const resting = Array.from(view.container.querySelectorAll("g > g"), (dot) => ({
    transform: (dot as SVGGElement).style.transform,
    opacity: (dot as SVGGElement).style.opacity,
  }));
  expect(calls).toHaveLength(0);
  await act(async () => {
    reduced = false;
    mediaEvents.dispatchEvent(new window.Event("change"));
  });
  expect(calls).toHaveLength(18);
  await act(async () => {
    reduced = true;
    mediaEvents.dispatchEvent(new window.Event("change"));
  });
  const dots = view.container.querySelectorAll("g > g");
  for (const [index, dot] of Array.from(dots).entries()) {
    expect((dot as SVGGElement).style.transform).toBe(resting[index]!.transform);
    expect((dot as SVGGElement).style.opacity).toBe(resting[index]!.opacity);
  }
  expect(
    calls.every(
      ({ animation }) => (animation.cancel as ReturnType<typeof mock>).mock.calls.length > 0
    )
  ).toBe(true);
});

test("soft starting noise is stable, varies by identity, and gently favors the center", () => {
  const sizes = AGENT_DOTS.map((_, index) => dotRestScale(index, "Lyra"));
  expect(sizes).toEqual(AGENT_DOTS.map((_, index) => dotRestScale(index, "Lyra")));
  expect(sizes).not.toEqual(AGENT_DOTS.map((_, index) => dotRestScale(index, "Reed")));
  expect(new Set(sizes).size).toBe(18);
  const nearCenter = sizes.filter(
    (_, index) => Math.hypot(AGENT_DOTS[index]!.x - 20, AGENT_DOTS[index]!.y - 20) < 7
  );
  const atEdge = sizes.filter(
    (_, index) => Math.hypot(AGENT_DOTS[index]!.x - 20, AGENT_DOTS[index]!.y - 20) > 13
  );
  const mean = (values: number[]) => values.reduce((sum, size) => sum + size, 0) / values.length;
  expect(mean(nearCenter) - mean(atEdge)).toBeGreaterThan(0.1);
  const view = render(<OrganicActivityMark label="Processing" seed="Lyra" state="idle" />);
  const dots = view.container.querySelectorAll("g > g");
  for (const [index, dot] of Array.from(dots).entries()) {
    expect((dot as SVGGElement).style.transform).toBe(`scale(${sizes[index]})`);
    expect(Number((dot as SVGGElement).style.opacity)).toBeCloseTo(dotOpacity(sizes[index]!));
    expect(calls[index]!.frames.at(-1)?.transform).toBe(`scale(${sizes[index]})`);
  }
  const html = renderToString(<OrganicActivityMark seed="Lyra" />);
  expect(html).toBe(renderToString(<OrganicActivityMark seed="Lyra" />));
});

test("same-name subagents render distinct starting frames and retain them across card updates", () => {
  reduced = true;
  const agent = createDemoSubagents()[0]!;
  const seed = agent.activitySeed!;
  const otherSeed = createSubagentActivitySeed({ ...agent, id: "another-agent" });
  const marks = (state: "idle" | "working") => (
    <>
      <SubagentIdentityMark name={agent.name} seed={seed} state={state} />
      <SubagentIdentityMark name={agent.name} seed={otherSeed} state={state} />
    </>
  );
  const view = render(marks("idle"));
  const startingFrames = () =>
    Array.from(view.container.querySelectorAll("svg"), (grid) =>
      Array.from(grid.querySelectorAll("g > g"), (dot) => (dot as SVGGElement).style.cssText)
    );
  const initial = startingFrames();

  expect(initial).toHaveLength(2);
  expect(initial[0]).not.toEqual(initial[1]);
  view.rerender(marks("working"));
  expect(startingFrames()).toEqual(initial);
  expect(renderToString(marks("idle"))).toBe(renderToString(marks("idle")));
  view.unmount();
  const remounted = render(marks("idle"));
  expect(
    Array.from(
      remounted.container.querySelectorAll("g > g"),
      (dot) => (dot as SVGGElement).style.cssText
    )
  ).toEqual(initial.flat());
});

test("the glass cover and SVG fill one local stack; stored identity images remain available", () => {
  const view = render(<SubagentIdentityMark name="Lyra" state="working" />);
  const mark = view.getByRole("img", { name: "Lyra identity mark" });
  expect(mark.classList.contains("isolate")).toBe(true);
  const background = mark.firstElementChild as HTMLElement;
  const base = mark.querySelector<HTMLElement>('[data-activity-layer="base"]')!;
  expect(base.classList.contains("inset-0")).toBe(true);
  expect(base.style.zIndex).toBe("0");
  expect(base.querySelector("svg")?.getAttribute("width")).toBe("100%");
  const noise = mark.querySelector<HTMLElement>('[data-activity-layer="noise"]')!;
  expect(noise.getAttribute("data-activity-layer")).toBe("noise");
  expect(noise.classList.contains("organic-activity-grain")).toBe(true);
  expect(noise.style.zIndex).toBe("1");
  expect(background.contains(base)).toBe(true);
  expect(background.contains(noise)).toBe(true);
  expect(background.style.filter).toStartWith("blur(4px)");
  const cover = mark.lastElementChild as HTMLElement;
  expect(cover.classList.contains("organic-glass-smoke")).toBe(true);
  expect(cover.classList.contains("inset-0")).toBe(true);
  expect(cover.style.zIndex).toBe("2");
  view.rerender(<SubagentIdentityMark imageUrl="/identity.png" name="Lyra" />);
  expect(mark.querySelector("img")?.getAttribute("src")).toBe("/identity.png");
  expect(mark.querySelector("svg")).toBeNull();
  expect(mark.lastElementChild).toBe(cover);
  expect(cover.style.zIndex).toBe("2");
});

test("one owner state synchronizes dots and glass while per-state material overrides stay bounded", () => {
  // Unsupported physics keeps material changes immediate while the native dot grid still runs.
  Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: undefined });
  const view = render(<OrganicActivityMark label="Agent" renderer="v0" state="working" />);
  const mark = view.getByRole("img", { name: "Agent" });
  const base = mark.querySelector<HTMLElement>('[data-activity-layer="base"]')!;
  const noise = mark.querySelector<HTMLElement>('[data-activity-layer="noise"]')!;
  const cover = mark.lastElementChild as HTMLElement;
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("4px");
  expect(cover.style.getPropertyValue("--activity-glass-brightness")).toBe("1.08");
  expect(Number.parseFloat(cover.style.getPropertyValue("--activity-glass-opacity"))).toBeCloseTo(
    28
  );
  const before = calls.length;
  view.rerender(
    <OrganicActivityMark
      label="Agent"
      renderer="v0"
      state="waiting"
      glassByState={{
        working: { blur: 12 },
        waiting: { opacity: 0, blur: 5, tint: "var(--accent)" },
      }}
    />
  );
  expect(mark.lastElementChild).toBe(cover);
  expect(
    [mark, base, noise, cover].map((layer) => layer.getAttribute("data-activity-state"))
  ).toEqual(["waiting", "waiting", "waiting", "waiting"]);
  expect(cover.style.zIndex).toBe("2");
  expect(base.style.zIndex).toBe("0");
  expect(calls.slice(before)).toHaveLength(18);
  expect(calls.slice(before).every(({ options }) => options.duration === 5000)).toBe(true);
  expect(cover.style.getPropertyValue("--activity-glass-opacity")).toBe("0%");
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("5px");
  expect(cover.style.getPropertyValue("--activity-glass-tint")).toBe("var(--accent)");
  view.rerender(
    <OrganicActivityMark
      label="Agent"
      renderer="v0"
      state="waiting"
      glassByState={{
        waiting: { opacity: 2, blur: 500 },
      }}
    />
  );
  expect(cover.style.getPropertyValue("--activity-glass-opacity")).toBe("100%");
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("14px");
  view.rerender(
    <OrganicActivityMark
      label="Agent"
      renderer="v0"
      state="waiting"
      glassByState={{
        waiting: { opacity: NaN, blur: Infinity, tint: "" },
      }}
    />
  );
  expect(Number.parseFloat(cover.style.getPropertyValue("--activity-glass-opacity"))).toBeCloseTo(
    38
  );
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("8px");
  expect(cover.style.getPropertyValue("--activity-glass-tint")).toBe("var(--background)");
});
