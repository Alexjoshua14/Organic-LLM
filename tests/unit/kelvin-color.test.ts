import { describe, expect, test } from "bun:test";

import {
  contextFillKelvin,
  contextSegmentKelvin,
  kelvinToCss,
  kelvinToRgb,
  LUMEN_KELVIN_DEEP,
  LUMEN_KELVIN_RIM,
} from "@/lib/design/kelvin-color";

describe("kelvin-color", () => {
  test("maps lumen anchors to warm RGB", () => {
    const deep = kelvinToRgb(LUMEN_KELVIN_DEEP);
    const rim = kelvinToRgb(LUMEN_KELVIN_RIM);

    expect(deep.r).toBeGreaterThan(deep.b);
    expect(rim.r).toBeGreaterThan(rim.b);
    expect(rim.g).toBeGreaterThanOrEqual(deep.g);
  });

  test("raises fill temperature as context saturates", () => {
    const empty = contextFillKelvin(0);
    const half = contextFillKelvin(0.5);
    const full = contextFillKelvin(1);

    expect(empty).toBe(LUMEN_KELVIN_DEEP);
    expect(half).toBeGreaterThan(empty);
    expect(full).toBeGreaterThan(half);
  });

  test("keeps remaining headroom cooler than used segments", () => {
    const free = contextSegmentKelvin("free", 0.4);
    const messages = contextSegmentKelvin("messages", 0.4);

    expect(free).toBeGreaterThan(messages);
  });

  test("formats css rgb strings", () => {
    expect(kelvinToCss(3000)).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    expect(kelvinToCss(3000, 0.5)).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.5\)$/);
  });
});
