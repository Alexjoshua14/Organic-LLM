import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { activityGlassForState } from "@/components/agents/activity-mark-glass";
import { GlassMorphPhysics } from "@/components/agents/glass-morph-physics";
import { MorphActivityGlass } from "@/components/agents/morph-activity-glass";
import { getSettings, setSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import * as userSettings from "@/lib/user-settings";
import { schedulerFixture } from "../helpers/dot-physics-runtime";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

const descriptors = [
  [globalThis, "IntersectionObserver"],
  [window, "matchMedia"],
  [window, "requestAnimationFrame"],
  [window, "cancelAnimationFrame"],
] as const;
const originals = descriptors.map(([object, key]) => Object.getOwnPropertyDescriptor(object, key));
let reduced = false;
let media: EventTarget;
let intersection: IntersectionObserverCallback;
let restoreSettings: () => void;

beforeEach(() => {
  restoreSettings = mockModulePreservingReal(
    "@/lib/user-settings",
    userSettings,
    globalThis.__realUserSettings
  );
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
  reduced = false;
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
        intersection = callback;
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
  descriptors.forEach(([object, key], index) => {
    const descriptor = originals[index];
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else Reflect.deleteProperty(object, key);
  });
});

function show(value = true) {
  intersection(
    [{ isIntersecting: value } as IntersectionObserverEntry],
    {} as IntersectionObserver
  );
}

test("material springs interpolate all channels, retain momentum on retarget, stay bounded and settle", () => {
  const initial = activityGlassForState("idle");
  const target = activityGlassForState("working");
  const physics = new GlassMorphPhysics(initial);
  physics.morphTo(target);
  const before = { ...physics.step(16) };
  expect(before.blur).toBeLessThan(initial.blur);
  expect(before.blur).toBeGreaterThan(target.blur);
  expect(before.opacity).toBeLessThan(initial.opacity);
  expect(before.brightness).toBeGreaterThan(initial.brightness);
  physics.morphTo(initial);
  expect(physics.current).toEqual(before);
  // The existing downward velocity survives instead of snapping/restarting at zero.
  expect(physics.step(1).blur).toBeLessThan(before.blur);
  for (let frame = 0; frame < 200 && !physics.settled; frame++) physics.step(16);
  expect(physics.current).toEqual({
    blur: initial.blur,
    opacity: initial.opacity,
    brightness: initial.brightness,
  });
  expect(physics.settled).toBe(true);
  physics.morphTo({ blur: 500, opacity: -1, brightness: 9 });
  for (let frame = 0; frame < 200 && !physics.settled; frame++) {
    const pose = physics.step(5000);
    expect(pose.blur).toBeLessThanOrEqual(200);
    expect(pose.opacity).toBeGreaterThanOrEqual(0);
    expect(pose.brightness).toBeLessThanOrEqual(2);
  }
  expect(physics.current).toEqual({ blur: 200, opacity: 0, brightness: 2 });
  expect(() => physics.morphTo({ blur: NaN, opacity: 1, brightness: 1 })).toThrow();
  expect(() => physics.step(Infinity)).toThrow();
  expect(activityGlassForState("idle", { idle: { brightness: NaN } }).brightness).toBe(1);
});

test("the actual cover hydrates a stable baseline, springs CSS values and stops all frame work when settled", () => {
  const fixture = schedulerFixture();
  const initial = activityGlassForState("idle");
  const target = activityGlassForState("working");
  let profiledUpdates = 0;
  fixture.scheduler.subscribeMetrics((sample) => {
    profiledUpdates += sample.groups.find((group) => group.id === "cover")?.updates ?? 0;
  });
  const markup = renderToString(<MorphActivityGlass appearance={initial} state="idle" />);
  expect(markup).toBe(renderToString(<MorphActivityGlass appearance={initial} state="idle" />));
  expect(markup).toContain("--activity-glass-blur:10px");
  expect(markup).toContain("backdrop-filter:blur(10px) brightness(1)");
  expect(markup).toContain("-webkit-backdrop-filter:blur(10px) brightness(1)");
  const view = render(
    <MorphActivityGlass
      appearance={initial}
      performanceId="cover"
      state="idle"
      scheduler={fixture.scheduler}
    />
  );
  const cover = view.container.firstElementChild as HTMLElement;
  show();
  expect(fixture.frames.size).toBe(0);
  view.rerender(
    <MorphActivityGlass
      appearance={target}
      performanceId="cover"
      state="working"
      scheduler={fixture.scheduler}
    />
  );
  expect(view.container.firstElementChild).toBe(cover);
  expect(cover.dataset.activityState).toBe("working");
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("10px");
  fixture.frame(16);
  const blur = Number.parseFloat(cover.style.getPropertyValue("--activity-glass-blur"));
  expect(blur).toBeGreaterThan(4);
  expect(blur).toBeLessThan(10);
  expect(cover.style.getPropertyValue("backdrop-filter")).toStartWith(`blur(${blur}px)`);
  expect(
    Number.parseFloat(cover.style.getPropertyValue("--activity-glass-brightness"))
  ).toBeGreaterThan(1);
  for (let frame = 0; frame < 200 && fixture.frames.size; frame++) fixture.frame(16);
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("4px");
  expect(cover.style.getPropertyValue("--activity-glass-brightness")).toBe("1.08");
  expect(cover.style.getPropertyValue("backdrop-filter")).toStartWith("blur(4px) brightness(1.08)");
  expect(fixture.frames.size).toBe(0);
  expect(profiledUpdates).toBeGreaterThan(0);

  // Same-state tuning changes the rendered backdrop without remounting the dots or cover.
  for (const blur of [80, 0]) {
    view.rerender(
      <MorphActivityGlass
        appearance={{ ...target, blur }}
        performanceId="cover"
        state="working"
        scheduler={fixture.scheduler}
      />
    );
    for (let frame = 0; frame < 200 && fixture.frames.size; frame++) fixture.frame(16);
    expect(view.container.firstElementChild).toBe(cover);
    expect(cover.style.getPropertyValue("backdrop-filter")).toStartWith(`blur(${blur}px)`);
    expect(fixture.frames.size).toBe(0);
  }
});

test("offscreen and hidden covers pause without losing their spring and unmount removes work", () => {
  const fixture = schedulerFixture();
  const view = render(
    <MorphActivityGlass
      appearance={activityGlassForState("idle")}
      state="idle"
      scheduler={fixture.scheduler}
    />
  );
  show();
  view.rerender(
    <MorphActivityGlass
      appearance={activityGlassForState("working")}
      state="working"
      scheduler={fixture.scheduler}
    />
  );
  fixture.frame(16);
  const cover = view.container.firstElementChild as HTMLElement;
  const before = cover.style.getPropertyValue("--activity-glass-blur");
  show(false);
  expect(fixture.frames.size).toBe(0);
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe(before);
  show();
  fixture.hide(true);
  expect(fixture.frames.size).toBe(0);
  fixture.hide(false);
  fixture.frame(16);
  expect(Number.parseFloat(cover.style.getPropertyValue("--activity-glass-blur"))).toBeLessThan(
    Number.parseFloat(before)
  );
  view.unmount();
  expect(fixture.frames.size).toBe(0);
});

test("reduced motion and same-tab/cross-tab lightweight settings snap to the target and release frames", async () => {
  const fixture = schedulerFixture();
  const view = render(
    <MorphActivityGlass
      appearance={activityGlassForState("idle")}
      state="idle"
      scheduler={fixture.scheduler}
    />
  );
  show();
  view.rerender(
    <MorphActivityGlass
      appearance={activityGlassForState("working")}
      state="working"
      scheduler={fixture.scheduler}
    />
  );
  fixture.frame(16);
  await act(async () => {
    reduced = true;
    media.dispatchEvent(new window.Event("change"));
  });
  const cover = view.container.firstElementChild as HTMLElement;
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("4px");
  expect(fixture.frames.size).toBe(0);
  reduced = false;
  media.dispatchEvent(new window.Event("change"));
  view.rerender(
    <MorphActivityGlass
      appearance={activityGlassForState("idle")}
      state="idle"
      scheduler={fixture.scheduler}
    />
  );
  expect(fixture.frames.size).toBe(1);
  setSettings({ lightweightMode: true });
  expect(getSettings().lightweightMode).toBe(true);
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("10px");
  expect(fixture.frames.size).toBe(0);
  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify({ lightweightMode: false }));
  window.dispatchEvent(new window.StorageEvent("storage", { key: USER_SETTINGS_STORAGE_KEY }));
  view.rerender(
    <MorphActivityGlass
      appearance={activityGlassForState("working")}
      state="working"
      scheduler={fixture.scheduler}
    />
  );
  expect(fixture.frames.size).toBe(1);
  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify({ lightweightMode: true }));
  window.dispatchEvent(new window.StorageEvent("storage", { key: USER_SETTINGS_STORAGE_KEY }));
  expect(fixture.frames.size).toBe(0);
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("4px");
});

test("scheduler failure settles the cover explicitly, leaving no animation retry loop", () => {
  const fixture = schedulerFixture();
  const view = render(
    <MorphActivityGlass
      appearance={activityGlassForState("idle")}
      state="idle"
      scheduler={fixture.scheduler}
    />
  );
  show();
  view.rerender(
    <MorphActivityGlass
      appearance={activityGlassForState("working")}
      state="working"
      scheduler={fixture.scheduler}
    />
  );
  fixture.scheduler.register(() => {
    throw new Error("engine failed");
  });
  fixture.frame(16);
  expect(fixture.scheduler.failure).toBe("engine-error");
  expect(fixture.frames.size).toBe(0);
  const cover = view.container.firstElementChild as HTMLElement;
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("4px");
  view.rerender(
    <MorphActivityGlass
      appearance={activityGlassForState("idle")}
      state="idle"
      scheduler={fixture.scheduler}
    />
  );
  expect(cover.style.getPropertyValue("--activity-glass-blur")).toBe("10px");
  expect(fixture.frames.size).toBe(0);
});
