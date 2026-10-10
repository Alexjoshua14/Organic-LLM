import { describe, expect, test } from "bun:test";

import {
  isTallViewport,
  tallSidebarMaxHeightCss,
  tallSidebarMaxHeightPx,
  TALL_SIDEBAR_MAX_VH,
  TALL_SIDEBAR_WIDTH_FACTOR,
  TALL_VIEWPORT_MIN_HEIGHT_PX,
  TALL_VIEWPORT_MIN_WIDTH_PX,
} from "@/lib/sidebar/tall-viewport";

describe("isTallViewport", () => {
  test("rejects mobile widths", () => {
    expect(isTallViewport(TALL_VIEWPORT_MIN_WIDTH_PX - 1, 1400)).toBe(false);
  });

  test("rejects short desktop windows", () => {
    expect(isTallViewport(900, TALL_VIEWPORT_MIN_HEIGHT_PX - 1)).toBe(false);
  });

  test("rejects landscape / wide aspect", () => {
    expect(isTallViewport(1440, 900)).toBe(false);
  });

  test("accepts portrait desktop like a 24in rotated monitor", () => {
    expect(isTallViewport(1080, 1920)).toBe(true);
  });

  test("accepts mildly tall desktop above the ratio floor", () => {
    expect(isTallViewport(1000, 1200)).toBe(true);
  });
});

describe("tallSidebarMaxHeightPx", () => {
  test("caps by width factor when portrait is very tall", () => {
    const width = 1080;
    const height = 1920;
    const expected = Math.round(
      Math.min(height * TALL_SIDEBAR_MAX_VH, width * TALL_SIDEBAR_WIDTH_FACTOR)
    );

    expect(tallSidebarMaxHeightPx(width, height)).toBe(expected);
    expect(expected).toBeLessThan(height * TALL_SIDEBAR_MAX_VH);
  });

  test("returns a css pixel length", () => {
    expect(tallSidebarMaxHeightCss(1080, 1920)).toBe(`${tallSidebarMaxHeightPx(1080, 1920)}px`);
  });

  test("returns 0 for invalid dimensions", () => {
    expect(tallSidebarMaxHeightPx(0, 1000)).toBe(0);
  });
});
