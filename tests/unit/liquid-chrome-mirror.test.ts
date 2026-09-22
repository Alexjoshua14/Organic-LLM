import type { LiquidChromeSource } from "@/lib/background/liquid-chrome-source";

import { afterEach, describe, expect, test } from "bun:test";

import {
  chromeUvTransform,
  cssColorToRgba,
  effectiveOpacity,
  parseRgbFunction,
  resolveBackdropRgb,
} from "@/lib/background/liquid-chrome-mirror";
import {
  LIQUID_CHROME_RENDER_IMAGE_GLSL,
  LIQUID_CHROME_SAMPLE_GLSL,
  LIQUID_CHROME_UNIFORMS_GLSL,
} from "@/lib/background/liquid-chrome-shader";
import {
  getActiveLiquidChromeSource,
  liquidChromePhaseAt,
  registerLiquidChromeSource,
  resetLiquidChromeSourcesForTests,
} from "@/lib/background/liquid-chrome-source";

function source(overrides: Partial<LiquidChromeSource> = {}): LiquidChromeSource {
  const element = document.createElement("div");

  document.body.appendChild(element);

  return {
    element,
    uniforms: {
      uTime: { value: 4.2 },
      uResolution: { value: [1920, 1200, 1.6] },
      uBaseColor: { value: [0.5, 0.48, 0.46] },
      uAmplitude: { value: 0.18 },
      uFrequencyX: { value: 3 },
      uFrequencyY: { value: 2 },
      uMouse: { value: [0, 0] },
      uMultiSample: { value: 1 },
    },
    isRunning: () => true,
    getSpeed: () => 0.012,
    ...overrides,
  };
}

afterEach(() => {
  resetLiquidChromeSourcesForTests();
  document.body.innerHTML = "";
});

describe("liquid chrome source registry", () => {
  test("is empty until a background registers", () => {
    expect(getActiveLiquidChromeSource()).toBeNull();
  });

  test("returns the most recently mounted background", () => {
    const first = source();
    const second = source();

    registerLiquidChromeSource(first);
    registerLiquidChromeSource(second);

    // During a route transition the incoming page registers last.
    expect(getActiveLiquidChromeSource()).toBe(second);
  });

  test("unregistering falls back to the previous background", () => {
    const first = source();
    const second = source();

    registerLiquidChromeSource(first);
    const unregister = registerLiquidChromeSource(second);

    unregister();
    expect(getActiveLiquidChromeSource()).toBe(first);
  });

  test("skips a background whose element has left the document", () => {
    const live = source();
    const detached = source();

    registerLiquidChromeSource(live);
    registerLiquidChromeSource(detached);
    detached.element.remove();

    expect(getActiveLiquidChromeSource()).toBe(live);
  });

  test("unregistering twice is harmless", () => {
    const unregister = registerLiquidChromeSource(source());

    unregister();
    expect(() => unregister()).not.toThrow();
  });
});

describe("liquidChromePhaseAt", () => {
  test("while running, is the background's own clock formula", () => {
    // LiquidChrome sets uTime = rAF ms × 0.001 × speed; the mirror must land on the same value.
    expect(liquidChromePhaseAt(source(), 10_000)).toBeCloseTo(10_000 * 0.001 * 0.012, 12);
  });

  test("while paused, holds the last value the background rendered", () => {
    const paused = source({ isRunning: () => false });

    expect(liquidChromePhaseAt(paused, 99_999)).toBe(4.2);
  });

  test("follows a live speed change", () => {
    let speed = 0.012;
    const live = source({ getSpeed: () => speed });

    speed = 0.2;
    expect(liquidChromePhaseAt(live, 1_000)).toBeCloseTo(0.2, 12);
  });
});

describe("chromeUvTransform", () => {
  const chrome = { left: 0, top: 0, width: 1280, height: 800 };

  test("maps the bar's bottom-left corner into field UV, with the y-flip", () => {
    const { offset } = chromeUvTransform({ left: 300, top: 560, width: 620, height: 32 }, chrome);

    // Client rects grow downward; GL UV grows upward from the bottom.
    expect(offset[0]).toBeCloseTo(300 / 1280, 9);
    expect(offset[1]).toBeCloseTo((800 - 592) / 800, 9);
  });

  test("scales the bar's UV square to its share of the field", () => {
    const { scale } = chromeUvTransform({ left: 300, top: 560, width: 620, height: 32 }, chrome);

    expect(scale[0]).toBeCloseTo(620 / 1280, 9);
    expect(scale[1]).toBeCloseTo(32 / 800, 9);
  });

  test("a bar covering the whole field maps to the identity", () => {
    expect(chromeUvTransform(chrome, chrome)).toEqual({ offset: [0, 0], scale: [1, 1] });
  });

  test("accounts for a chrome that does not start at the viewport origin", () => {
    const offsetChrome = { left: 100, top: 50, width: 1000, height: 500 };
    const { offset } = chromeUvTransform(
      { left: 100, top: 520, width: 200, height: 30 },
      offsetChrome
    );

    expect(offset[0]).toBeCloseTo(0, 9);
    expect(offset[1]).toBeCloseTo(0, 9);
  });

  test("a zero-sized chrome does not divide by zero", () => {
    const result = chromeUvTransform(
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 0, top: 0, width: 0, height: 0 }
    );

    expect(result.scale.every(Number.isFinite)).toBe(true);
  });
});

describe("effectiveOpacity", () => {
  test("multiplies opacity up the tree, as the browser composites it", () => {
    const wrapper = document.createElement("div");
    const inner = document.createElement("div");
    const leaf = document.createElement("div");

    wrapper.style.opacity = "0.5";
    inner.style.opacity = "0.8";
    wrapper.appendChild(inner);
    inner.appendChild(leaf);
    document.body.appendChild(wrapper);

    expect(effectiveOpacity(leaf).opacity).toBeCloseTo(0.4, 9);
  });

  test("names the outermost translucent ancestor as the fade root", () => {
    const wrapper = document.createElement("div");
    const inner = document.createElement("div");

    wrapper.style.opacity = "0.92";
    inner.style.opacity = "0.5";
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    expect(effectiveOpacity(inner).fadeRoot).toBe(wrapper);
  });

  test("is fully opaque with no fade root when nothing is translucent", () => {
    const leaf = document.createElement("div");

    document.body.appendChild(leaf);
    expect(effectiveOpacity(leaf)).toEqual({ opacity: 1, fadeRoot: null });
  });
});

describe("parseRgbFunction", () => {
  test("reads comma syntax", () => {
    expect(parseRgbFunction("rgb(255, 0, 51)")).toEqual([1, 0, 0.2, 1]);
  });

  test("reads space syntax with slash alpha", () => {
    expect(parseRgbFunction("rgb(255 255 255 / 0.5)")).toEqual([1, 1, 1, 0.5]);
  });

  test("reads rgba", () => {
    expect(parseRgbFunction("rgba(0, 0, 0, 0)")).toEqual([0, 0, 0, 0]);
  });

  test("reads a percentage alpha", () => {
    expect(parseRgbFunction("rgb(0 0 0 / 25%)")![3]).toBeCloseTo(0.25, 9);
  });

  test("rejects anything else", () => {
    expect(parseRgbFunction("oklch(0.8 0.1 60)")).toBeNull();
    expect(parseRgbFunction("rgb(1, 2)")).toBeNull();
  });
});

describe("cssColorToRgba", () => {
  test("treats empty and transparent as fully transparent", () => {
    expect(cssColorToRgba("")).toEqual([0, 0, 0, 0]);
    expect(cssColorToRgba("transparent")).toEqual([0, 0, 0, 0]);
  });

  test("falls back to rgb() parsing where no 2D canvas exists", () => {
    expect(cssColorToRgba("rgb(0, 255, 0)")).toEqual([0, 1, 0, 1]);
  });
});

describe("resolveBackdropRgb", () => {
  test("stops at the first opaque background up the tree", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");

    outer.style.backgroundColor = "rgb(0, 0, 255)";
    outer.appendChild(inner);
    document.body.appendChild(outer);

    expect(resolveBackdropRgb(inner)).toEqual([0, 0, 1]);
  });

  test("composites translucent layers over the opaque base", () => {
    const base = document.createElement("div");
    const veil = document.createElement("div");

    base.style.backgroundColor = "rgb(0, 0, 0)";
    veil.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    base.appendChild(veil);
    document.body.appendChild(base);

    const [r, g, b] = resolveBackdropRgb(veil);

    expect(r).toBeCloseTo(0.5, 6);
    expect(g).toBeCloseTo(0.5, 6);
    expect(b).toBeCloseTo(0.5, 6);
  });

  test("falls back to white when nothing paints a background", () => {
    expect(resolveBackdropRgb(null)).toEqual([1, 1, 1]);
  });
});

describe("shared LiquidChrome GLSL", () => {
  test("declares every uniform the mirror copies from the live background", () => {
    for (const name of [
      "uTime",
      "uResolution",
      "uBaseColor",
      "uAmplitude",
      "uFrequencyX",
      "uFrequencyY",
      "uMouse",
      "uMultiSample",
    ]) {
      expect(LIQUID_CHROME_UNIFORMS_GLSL).toContain(name);
    }
  });

  test("exposes the kernel-averaged sampler the mirror calls", () => {
    expect(LIQUID_CHROME_RENDER_IMAGE_GLSL).toContain("vec4 renderImage(vec2 uvCoord)");
    expect(LIQUID_CHROME_SAMPLE_GLSL).toContain("vec4 sampleLiquidChrome(vec2 uvCoord)");
  });
});
