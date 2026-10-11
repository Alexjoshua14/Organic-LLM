import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { GlassBackdrop } from "@/components/design-system/glass-backdrop";
import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { ACTIVITY_GLASS_TINTS } from "@/components/agents/activity-mark-glass";
import { OrganicActivityMarkLab } from "@/app/sandbox/prototypes/organic-agent/_components/organic-activity-mark-lab";
import { SidebarProvider } from "@/components/third-party/ui/sidebar";
import * as tts from "@/lib/context/tts-context";
import * as userSettings from "@/lib/user-settings";
import { getSettings, setSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";
import { mockModulePreservingReal } from "../helpers/module-mock";
import { render } from "../helpers/render";

const surfaces = [
  [window, "CSS"],
  [window, "matchMedia"],
  [window, "requestAnimationFrame"],
  [window, "cancelAnimationFrame"],
  [globalThis, "IntersectionObserver"],
  [navigator, "clipboard"],
] as const;
const originals = surfaces.map(([object, key]) => Object.getOwnPropertyDescriptor(object, key));
let supported: boolean;
let preferences: Map<string, { matches: boolean; events: EventTarget }>;
let restoreSettings: () => void;
let restoreTts: () => void;
const writeText = mock(async (_text: string) => {});

beforeEach(() => {
  restoreSettings = mockModulePreservingReal(
    "@/lib/user-settings",
    userSettings,
    globalThis.__realUserSettings
  );
  restoreTts = mockModulePreservingReal("@/lib/context/tts-context", tts, {
    TTSDockBar: () => null,
  });
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
  supported = true;
  writeText.mockClear();
  writeText.mockImplementation(async () => {});
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  preferences = new Map();
  Object.defineProperty(window, "CSS", {
    configurable: true,
    value: { supports: () => supported },
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      if (!preferences.has(query)) {
        preferences.set(query, { matches: false, events: new window.EventTarget() });
      }
      const preference = preferences.get(query)!;
      return {
        media: query,
        get matches() {
          return preference.matches;
        },
        addEventListener: preference.events.addEventListener.bind(preference.events),
        removeEventListener: preference.events.removeEventListener.bind(preference.events),
      };
    },
  });
  Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: () => 1 });
  Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: () => {} });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  cleanup();
  restoreSettings();
  restoreTts();
  localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
  surfaces.forEach(([object, key], index) => {
    const original = originals[index];
    if (original) Object.defineProperty(object, key, original);
    else Reflect.deleteProperty(object, key);
  });
});

test("default and server rendering preserve the unfiltered background", () => {
  const content = <img alt="Owned backdrop" src="/backdrop.png" />;
  const plain = renderToString(<GlassBackdrop>{content}</GlassBackdrop>);
  expect(renderToString(<GlassBackdrop distortion>{content}</GlassBackdrop>)).toBe(plain);
  expect(plain).not.toContain("<filter");
  const view = render(
    <GlassBackdrop style={{ filter: "brightness(1.1)" }}>{content}</GlassBackdrop>
  );
  expect((view.container.firstElementChild as HTMLElement).style.filter).toBe("brightness(1.1)");
  expect(view.container.querySelector("filter")).toBeNull();
});

test("multiple backgrounds use unique SourceGraphic filters without SVG backdrop URLs", () => {
  const view = render(
    <>
      <GlassBackdrop distortion style={{ filter: "brightness(1.1)" }}>
        First backdrop
      </GlassBackdrop>
      <GlassBackdrop distortion>Second backdrop</GlassBackdrop>
    </>
  );
  const filters = [...view.container.querySelectorAll("filter")];
  expect(filters).toHaveLength(2);
  expect(new Set(filters.map((filter) => filter.id)).size).toBe(2);
  const sources = [...view.container.querySelectorAll<HTMLElement>("[data-glass-distortion]")];
  sources.forEach((source, index) => {
    expect(source.style.filter).toContain(`url("#${filters[index]!.id}")`);
    expect(source.style.getPropertyValue("backdrop-filter")).toBe("");
    expect(source.style.getPropertyValue("-webkit-backdrop-filter")).toBe("");
    expect(source.querySelector("feDisplacementMap")?.getAttribute("in")).toBe("SourceGraphic");
    expect(source.querySelector("feTurbulence")?.getAttribute("type")).toBe("fractalNoise");
  });
  expect(sources[0]!.style.filter).toStartWith("brightness(1.1) ");
});

test("accessibility preferences and same-tab/cross-tab Lightweight Mode disable distortion live", async () => {
  const view = render(<GlassBackdrop distortion>Keep the source</GlassBackdrop>);
  const source = view.container.firstElementChild as HTMLElement;
  for (const query of [
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-transparency: reduce)",
    "(prefers-contrast: more)",
  ]) {
    const preference = preferences.get(query)!;
    await act(async () => {
      preference.matches = true;
      preference.events.dispatchEvent(new window.Event("change"));
    });
    expect(source.dataset.glassDistortion).toBe("off");
    expect(source.textContent).toBe("Keep the source");
    await act(async () => {
      preference.matches = false;
      preference.events.dispatchEvent(new window.Event("change"));
    });
    expect(source.dataset.glassDistortion).toBe("on");
  }
  await act(async () => setSettings({ lightweightMode: true }));
  expect(source.dataset.glassDistortion).toBe("off");
  await act(async () => {
    localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify({ lightweightMode: false }));
    window.dispatchEvent(new window.StorageEvent("storage", { key: USER_SETTINGS_STORAGE_KEY }));
  });
  expect(source.dataset.glassDistortion).toBe("on");
});

test("unsupported capabilities leave the owned source intact", () => {
  supported = false;
  const view = render(<GlassBackdrop distortion>Still visible</GlassBackdrop>);
  expect(view.container.querySelector("filter")).toBeNull();
  expect(view.getByText("Still visible")).toBeTruthy();
  view.unmount();
  supported = true;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
  const unsupported = render(<GlassBackdrop distortion>Still visible</GlassBackdrop>);
  expect(unsupported.container.querySelector("filter")).toBeNull();
  expect(unsupported.getByText("Still visible")).toBeTruthy();
});

test("activity refraction preserves mounted dots, seeded poses, glass material and z-order", () => {
  const view = render(<OrganicActivityMark renderer="v0" seed="same-agent" state="working" />);
  const dots = view.container.querySelector("[data-dot-renderer]");
  const poses = [...view.container.querySelectorAll("circle")].map((dot) => dot.outerHTML);
  const source = view.container.querySelector<HTMLElement>('[data-activity-layer="base"]')!;
  const cover = view.container.querySelector<HTMLElement>('[data-activity-layer="glass"]')!;
  const material = cover.style.cssText;
  for (const glassDistortion of [true, false, true]) {
    view.rerender(
      <OrganicActivityMark
        glassDistortion={glassDistortion}
        renderer="v0"
        seed="same-agent"
        state="working"
      />
    );
    expect(view.container.querySelector("[data-dot-renderer]")).toBe(dots);
    expect([...view.container.querySelectorAll("circle")].map((dot) => dot.outerHTML)).toEqual(
      poses
    );
    expect(view.container.querySelector('[data-activity-layer="glass"]')).toBe(cover);
    expect(cover.style.cssText).toBe(material);
    expect(source.style.zIndex).toBe("0");
    expect(cover.style.zIndex).toBe("2");
    expect(source.dataset.glassDistortion).toBe(glassDistortion ? "on" : "off");
  }
});

test("glass tuning blurs both owned layers once, bounds oversized input and includes identity images", () => {
  const view = render(<OrganicActivityMark renderer="v0" state="idle" />);
  const background = view.container.querySelector<HTMLElement>('[data-activity-layer="backdrop"]')!;
  const cover = view.container.querySelector<HTMLElement>('[data-activity-layer="glass"]')!;
  const dots = view.container.querySelector("[data-dot-renderer]");
  const noise = view.container.querySelector('[data-activity-layer="noise"]');
  expect(background.contains(dots)).toBe(true);
  expect(background.contains(noise)).toBe(true);
  expect(background.contains(cover)).toBe(false);
  expect(background.style.filter).toBe("blur(1.25px) brightness(1) saturate(1.12)");
  expect(cover.style.getPropertyValue("--activity-glass-opacity")).toBe("72%");
  for (const blur of [-5, 0, 14, 200]) {
    view.rerender(
      <OrganicActivityMark renderer="v0" state="working" glassByState={{ working: { blur } }} />
    );
    expect(background.style.filter).toBe(
      `blur(${Math.max(0, Math.min(blur, 14))}px) brightness(1.08) saturate(1.12)`
    );
    expect(cover.style.getPropertyValue("backdrop-filter")).toBe("none");
    expect(view.container.querySelector("[data-dot-renderer]")).toBe(dots);
    expect(view.container.querySelector('[data-activity-layer="noise"]')).toBe(noise);
  }
  view.rerender(<OrganicActivityMark imageUrl="/identity.png" state="waiting" />);
  expect(background.contains(view.container.querySelector("img"))).toBe(true);
  expect(background.style.filter).toBe("blur(1.25px) brightness(1) saturate(1.12)");
  // JSDOM does not retain the prefixed property; check its server delivery instead.
  expect(renderToString(<OrganicActivityMark renderer="v0" />)).toContain(
    "-webkit-backdrop-filter:none"
  );
});

test("refraction tuning bounds invalid inputs and updates the same source/filter instance", () => {
  const view = render(
    <GlassBackdrop distortion distortionSettings={{ strength: 9, frequency: 0.07, softness: 1 }}>
      Backdrop
    </GlassBackdrop>
  );
  const source = view.container.firstElementChild;
  const filter = view.container.querySelector("filter");
  expect(view.container.querySelector("feDisplacementMap")?.getAttribute("scale")).toBe("9");
  expect(view.container.querySelector("feTurbulence")?.getAttribute("baseFrequency")).toBe("0.07");
  expect(view.container.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("1");
  view.rerender(
    <GlassBackdrop
      distortion
      distortionSettings={{ strength: 999, frequency: Infinity, softness: -4 }}
    >
      Backdrop
    </GlassBackdrop>
  );
  expect(view.container.firstElementChild).toBe(source);
  expect(view.container.querySelector("filter")).toBe(filter);
  expect(view.container.querySelector("feDisplacementMap")?.getAttribute("scale")).toBe("20");
  expect(view.container.querySelector("feTurbulence")?.getAttribute("baseFrequency")).toBe("0.035");
  expect(view.container.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("0");
});

test("agent defaults keep the approved state materials and enable refraction with preference fallbacks", async () => {
  const view = render(<OrganicActivityMark renderer="v0" />);
  const source = view.container.querySelector<HTMLElement>('[data-activity-layer="base"]')!;
  const background = view.container.querySelector<HTMLElement>('[data-activity-layer="backdrop"]')!;
  const cover = view.container.querySelector<HTMLElement>('[data-activity-layer="glass"]')!;
  expect(source.dataset.glassDistortion).toBe("on");
  for (const state of ["idle", "waiting", "blocked", "complete", "working"] as const) {
    view.rerender(<OrganicActivityMark renderer="v0" state={state} />);
    expect(background.style.filter).toBe(
      state === "working"
        ? "blur(0.5px) brightness(1.08) saturate(1.12)"
        : "blur(1.25px) brightness(1) saturate(1.12)"
    );
    expect(Number.parseFloat(cover.style.getPropertyValue("--activity-glass-opacity"))).toBeCloseTo(
      state === "working" ? 28 : 72
    );
    expect(cover.style.getPropertyValue("--activity-glass-tint")).toBe(
      state === "blocked"
        ? ACTIVITY_GLASS_TINTS.amber
        : state === "working"
          ? ACTIVITY_GLASS_TINTS.organic
          : ACTIVITY_GLASS_TINTS.neutral
    );
  }
  await act(async () => setSettings({ lightweightMode: true }));
  expect(source.dataset.glassDistortion).toBe("off");
  expect(view.container.querySelector("filter")).toBeNull();
});

test("manual controls reach every filter and copy complete, valid JSX for the selected state", async () => {
  const view = render(
    <SidebarProvider>
      <OrganicActivityMarkLab />
    </SidebarProvider>
  );
  await act(async () => {
    fireEvent.change(view.getByRole("combobox", { name: "State to tune" }), {
      target: { value: "waiting" },
    });
    fireEvent.change(view.getByRole("slider", { name: /Opacity/ }), { target: { value: "0.45" } });
    fireEvent.change(view.getByRole("slider", { name: /Backdrop blur/ }), {
      target: { value: "4.75" },
    });
    fireEvent.change(view.getByRole("slider", { name: /Brightness/ }), {
      target: { value: "1.1" },
    });
    fireEvent.change(view.getByRole("combobox", { name: "Color tint" }), {
      target: { value: ACTIVITY_GLASS_TINTS.amber },
    });
  });
  const dots = [...view.container.querySelectorAll("[data-dot-renderer]")];
  await act(async () => {
    fireEvent.change(view.getByRole("slider", { name: "Distortion strength" }), {
      target: { value: "11" },
    });
    fireEvent.change(view.getByRole("slider", { name: "Noise frequency" }), {
      target: { value: "0.075" },
    });
    fireEvent.change(view.getByRole("slider", { name: "Noise smoothness" }), {
      target: { value: "1.25" },
    });
  });
  expect([...view.container.querySelectorAll("[data-dot-renderer]")]).toEqual(dots);
  for (const filter of view.container.querySelectorAll("filter")) {
    expect(filter.querySelector("feDisplacementMap")?.getAttribute("scale")).toBe("11");
    expect(filter.querySelector("feTurbulence")?.getAttribute("baseFrequency")).toBe("0.075");
    expect(filter.querySelector("feGaussianBlur")?.getAttribute("stdDeviation")).toBe("1.25");
  }
  await act(async () => fireEvent.click(view.getByRole("button", { name: "Copy style" })));
  expect(writeText).toHaveBeenCalledTimes(1);
  const snippet = writeText.mock.calls[0]![0];
  expect(snippet).toContain('state="waiting"');
  expect(snippet).toContain('"opacity": 0.45');
  expect(snippet).toContain('"blur": 4.75');
  expect(snippet).toContain('"brightness": 1.1');
  expect(snippet).toContain(`"tint": ${JSON.stringify(ACTIVITY_GLASS_TINTS.amber)}`);
  expect(snippet).toContain("glassDistortion={true}");
  expect(snippet).toContain('"strength": 11');
  expect(snippet).toContain('"frequency": 0.075');
  expect(snippet).toContain('"softness": 1.25');
  expect(() => new Bun.Transpiler({ loader: "tsx" }).transformSync(snippet)).not.toThrow();
  expect(view.getByRole("button", { name: "Copied" })).toBeTruthy();
  await act(async () =>
    fireEvent.change(view.getByRole("slider", { name: "Distortion strength" }), {
      target: { value: "12" },
    })
  );
  expect(view.getByRole("button", { name: "Copy style" })).toBeTruthy();
  expect(getSettings().lightweightMode).toBe(false);
});

test("failed clipboard writes expose selectable JSX; stale writes cannot mark a newer style copied", async () => {
  let resolve!: () => void;
  writeText.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  const view = render(
    <SidebarProvider>
      <OrganicActivityMarkLab />
    </SidebarProvider>
  );
  await act(async () => fireEvent.click(view.getByRole("button", { name: "Copy style" })));
  await act(async () =>
    fireEvent.change(view.getByRole("combobox", { name: "State to tune" }), {
      target: { value: "idle" },
    })
  );
  await act(async () => resolve());
  expect(view.queryByRole("button", { name: "Copied" })).toBeNull();
  writeText.mockImplementation(async () => {
    throw new Error("Clipboard denied");
  });
  await act(async () => fireEvent.click(view.getByRole("button", { name: "Copy style" })));
  const fallback = view.getByRole("textbox", { name: "Style to copy" }) as HTMLTextAreaElement;
  expect(fallback.value).toContain('state="idle"');
  expect(fallback.value).toContain('"opacity": 0.72');
  expect(fallback.value).toContain('"blur": 1.25');
  expect(fallback.value).toContain("glassDistortion={true}");
  await act(async () => fallback.focus());
  expect(fallback.selectionStart).toBe(0);
  expect(fallback.selectionEnd).toBe(fallback.value.length);
});

test("the lab toggle covers all states and renderers, resets diagnostics and retains the dot instances", async () => {
  const settings = getSettings();
  const view = render(
    <SidebarProvider>
      <OrganicActivityMarkLab />
    </SidebarProvider>
  );
  const toggle = view.getByRole("switch", { name: "Distortion" });
  expect((toggle as HTMLInputElement).checked).toBe(true);
  const blur = view.getByRole("slider", { name: /Backdrop blur/ }) as HTMLInputElement;
  expect(blur.min).toBe("0");
  expect(blur.max).toBe("14");
  await act(async () => fireEvent.change(blur, { target: { value: "14" } }));
  const working = view.container.querySelector<HTMLElement>(
    '[data-activity-layer="backdrop"][data-activity-state="working"]'
  )!;
  expect(working.style.filter).toStartWith("blur(14px)");
  await act(async () => fireEvent.click(view.getByRole("button", { name: "Compare" })));
  const dots = [...view.container.querySelectorAll("[data-dot-renderer]")];
  const diagnostics = view.getByRole("region", { name: "Live activity performance" });
  expect(dots).toHaveLength(12);
  expect(view.container.querySelectorAll('[data-glass-distortion="on"]')).toHaveLength(12);
  await act(async () => fireEvent.click(toggle));
  expect([...view.container.querySelectorAll("[data-dot-renderer]")]).toEqual(dots);
  expect(view.container.querySelector("filter")).toBeNull();
  expect(view.getByRole("region", { name: "Live activity performance" })).not.toBe(diagnostics);
  await act(async () => fireEvent.click(toggle));
  expect(view.container.querySelectorAll('[data-glass-distortion="on"]')).toHaveLength(12);
  expect([...view.container.querySelectorAll("[data-dot-renderer]")]).toEqual(dots);
  expect(getSettings()).toEqual(settings);
});
