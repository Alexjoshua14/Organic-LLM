import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { AdaptiveAgentDotGrid } from "@/components/agents/adaptive-agent-dot-grid";
import { PhysicsAgentDotGrid } from "@/components/agents/physics-agent-dot-grid";
import { AgentDotGrid } from "@/components/agents/agent-dot-grid";
import { dotOpacity } from "@/components/agents/agent-dot-grid-motion";
import { getSettings, setSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import * as userSettings from "@/lib/user-settings";
import { UserSettingsSchema } from "@/lib/schemas/userSettings";
import { schedulerFixture } from "../helpers/dot-physics-runtime";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
const originalMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
const originalRaf = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
const originalCancel = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");
let media: EventTarget;
let reduced = false;
let observers: IntersectionObserverCallback[];
let restoreSettings: () => void;

beforeEach(() => {
  restoreSettings = mockModulePreservingReal(
    "@/lib/user-settings",
    userSettings,
    globalThis.__realUserSettings
  );
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
  reduced = false;
  observers = [];
  media = new window.EventTarget();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() {
        return reduced;
      },
      addEventListener: media.addEventListener.bind(media),
      removeEventListener: media.removeEventListener.bind(media),
    }),
  });
  Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: () => 1 });
  Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: () => {} });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  });
});

afterEach(() => {
  cleanup();
  restoreSettings();
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
  for (const [object, key, descriptor] of [
    [globalThis, "IntersectionObserver", originalObserver],
    [window, "matchMedia", originalMedia],
    [window, "requestAnimationFrame", originalRaf],
    [window, "cancelAnimationFrame", originalCancel],
  ] as const) {
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else Reflect.deleteProperty(object, key);
  }
});

async function visible(value = true) {
  await act(async () =>
    observers.forEach((callback) =>
      callback([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver)
    )
  );
}

test("actual SVG delivery uses independent physics dots, linked opacity, visibility cleanup, and one shared frame", async () => {
  const fixture = schedulerFixture();
  const fail = mock(() => {});
  let profiledUpdates = 0;
  fixture.scheduler.subscribeMetrics((sample) => {
    profiledUpdates += sample.groups.find((group) => group.id === "working-auto")?.updates ?? 0;
  });
  const view = render(
    <PhysicsAgentDotGrid
      onFailure={fail}
      performanceId="working-auto"
      scheduler={fixture.scheduler}
      seed="Lyra"
      state="working"
    />
  );
  expect(view.container.querySelectorAll("circle")).toHaveLength(18);
  expect(fixture.frames.size).toBe(0);
  await visible();
  expect(fixture.frames.size).toBe(1);
  await act(async () => {
    for (let frame = 0; frame < 20; frame++) fixture.frame(1000 / 60);
  });
  const transforms = new Set<string>();
  for (const dot of view.container.querySelectorAll("g > g")) {
    const style = (dot as SVGGElement).style;
    expect(style.transform).toContain("translate(");
    const scale = Number(style.transform.match(/scale\(([^)]+)\)/)?.[1]);
    expect(Number(style.opacity)).toBeCloseTo(dotOpacity(scale));
    transforms.add(style.transform);
  }
  expect(transforms.size).toBe(18);
  expect(profiledUpdates).toBe(20 * 18);
  await visible(false);
  expect(fixture.frames.size).toBe(0);
  await visible();
  expect(fixture.frames.size).toBe(1);
  view.unmount();
  expect(fixture.frames.size).toBe(0);
  expect(fail).not.toHaveBeenCalled();
});

test("SSR uses the exact v0 grid; reduced motion, lightweight mode, and unsupported capabilities avoid loading physics", async () => {
  const load = mock(async () => ({ PhysicsAgentDotGrid }));
  expect(renderToString(<AdaptiveAgentDotGrid seed="Lyra" state="working" />)).toBe(
    renderToString(<AgentDotGrid seed="Lyra" state="working" />)
  );
  reduced = true;
  let view = render(<AdaptiveAgentDotGrid loadPhysics={load} />);
  expect(load).not.toHaveBeenCalled();
  view.unmount();
  reduced = false;
  setSettings({ lightweightMode: true });
  view = render(<AdaptiveAgentDotGrid loadPhysics={load} />);
  expect(load).not.toHaveBeenCalled();
  view.unmount();
  setSettings({ lightweightMode: false });
  Reflect.deleteProperty(window, "requestAnimationFrame");
  view = render(<AdaptiveAgentDotGrid loadPhysics={load} />);
  expect(load).not.toHaveBeenCalled();
  expect(view.container.querySelectorAll("circle")).toHaveLength(18);
  view.unmount();
  expect(UserSettingsSchema.parse({}).lightweightMode).toBe(false);
});

test("preference changes swap the actual renderer and dispose its physics; cross-tab changes apply too", async () => {
  const fixture = schedulerFixture();
  const Physics = (props: Parameters<typeof PhysicsAgentDotGrid>[0]) => (
    <PhysicsAgentDotGrid {...props} scheduler={fixture.scheduler} />
  );
  const load = mock(async () => ({ PhysicsAgentDotGrid: Physics }));
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<AdaptiveAgentDotGrid loadPhysics={load} seed="Lyra" />);
  });
  expect(view.container.querySelector('[data-dot-renderer="physics"]')).toBeTruthy();
  await visible();
  expect(fixture.frames.size).toBe(1);
  await act(async () => {
    setSettings({ lightweightMode: true });
  });
  expect(getSettings().lightweightMode).toBe(true);
  expect(view.container.querySelector('[data-dot-renderer="physics"]')).toBeNull();
  expect(fixture.frames.size).toBe(0);
  await act(async () => {
    localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify({ lightweightMode: false }));
    window.dispatchEvent(new window.StorageEvent("storage", { key: USER_SETTINGS_STORAGE_KEY }));
  });
  expect(view.container.querySelector('[data-dot-renderer="physics"]')).toBeTruthy();
  await visible();
  await act(async () => {
    reduced = true;
    media.dispatchEvent(new window.Event("change"));
  });
  expect(view.container.querySelector('[data-dot-renderer="physics"]')).toBeNull();
  expect(fixture.frames.size).toBe(0);
});

test("sustained poor frame rate switches actual delivery to v0 and latches the physics fallback", async () => {
  const fixture = schedulerFixture();
  const Physics = (props: Parameters<typeof PhysicsAgentDotGrid>[0]) => (
    <PhysicsAgentDotGrid {...props} scheduler={fixture.scheduler} />
  );
  const load = async () => ({ PhysicsAgentDotGrid: Physics });
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<AdaptiveAgentDotGrid loadPhysics={load} state="working" />);
  });
  await visible();
  await act(async () => {
    for (let frame = 0; frame < 100 && fixture.frames.size; frame++) fixture.frame(50);
  });
  expect(fixture.scheduler.failure).toBe("frame-rate");
  expect(view.container.querySelector('[data-dot-renderer="physics"]')).toBeNull();
  expect(view.container.querySelectorAll("circle")).toHaveLength(18);
  expect(fixture.frames.size).toBe(0);
  await act(async () => {
    setSettings({ lightweightMode: false });
  });
  expect(view.container.querySelector('[data-dot-renderer="physics"]')).toBeNull();
});

test("failed chunk initialization and rendering retain v0 without retry loops", async () => {
  for (const mode of ["load", "render"] as const) {
    const Broken = () => {
      throw new Error("physics renderer failed");
    };
    const load = mock(async () => {
      if (mode === "load") throw new Error("chunk unavailable");
      return { PhysicsAgentDotGrid: Broken };
    });
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<AdaptiveAgentDotGrid loadPhysics={load} />);
    });
    expect(view.container.querySelectorAll("circle")).toHaveLength(18);
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      setSettings({ lightweightMode: false });
    });
    expect(load).toHaveBeenCalledTimes(1);
    view.unmount();
  }
});
