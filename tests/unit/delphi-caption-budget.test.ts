import { describe, expect, test } from "vitest";

import {
  AVG_CHAR_WIDTH_EM,
  computeCaptionAllocatedHeightPx,
  computeDelphiCaptionBudget,
  delphiScrollCharBudget,
  effectiveCharWidthPx,
  estimatePhysicalScreenInches,
  resolveDeviceLabel,
} from "@/lib/memory-ingest/delphi-caption-budget";

const mobileBase = {
  viewportWidthPx: 393,
  viewportHeightPx: 852,
  devicePixelRatio: 3,
  screenWidthPx: 393,
  screenHeightPx: 852,
  captionWidthPx: 360,
  fontSizePx: 15,
  lineHeightPx: 20.625,
  deviceTier: "mobile" as const,
  rootFontSizePx: 16,
};

describe("computeDelphiCaptionBudget", () => {
  test("derives visible lines from allocated height / line height", () => {
    const budget = computeDelphiCaptionBudget({
      ...mobileBase,
      captionAllocatedHeightPx: 103.125,
    });

    expect(budget.visibleLines).toBe(5);
    expect(budget.visibleHeightPx).toBeCloseTo(5 * 20.625, 5);
  });

  test("derives max chars from caption width and measured char width", () => {
    const budget = computeDelphiCaptionBudget({
      ...mobileBase,
      captionAllocatedHeightPx: 103,
      avgCharWidthPx: 9.2,
    });

    expect(budget.maxCharsPerLine).toBe(Math.floor(360 / 9.2));
  });

  test("falls back to em ratio when avgCharWidthPx omitted", () => {
    expect(effectiveCharWidthPx(15)).toBeCloseTo(15 * AVG_CHAR_WIDTH_EM, 5);
  });

  test("scroll max lines exceed visible lines on tall viewports", () => {
    const budget = computeDelphiCaptionBudget({
      viewportWidthPx: 1200,
      viewportHeightPx: 900,
      devicePixelRatio: 2,
      screenWidthPx: 1200,
      screenHeightPx: 900,
      captionWidthPx: 640,
      captionAllocatedHeightPx: 330,
      fontSizePx: 16,
      lineHeightPx: 22,
      avgCharWidthPx: 8.5,
      deviceTier: "desktop",
      rootFontSizePx: 16,
    });

    expect(budget.visibleLines).toBe(15);
    expect(budget.scrollMaxLines).toBeGreaterThan(budget.visibleLines);
    expect(budget.maxCharsPerLine).toBe(Math.floor(640 / 8.5));
  });

  test("prompt text includes computed numbers", () => {
    const budget = computeDelphiCaptionBudget({
      ...mobileBase,
      captionAllocatedHeightPx: 82.5,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });

    expect(budget.promptText).toContain(`${budget.visibleLines} visible lines`);
    expect(budget.promptText).toContain(`~${budget.maxCharsPerLine} chars/line`);
    expect(budget.deviceLabel).toMatch(/iPhone/i);
  });

  test("char budget scales with scroll lines and chars per line", () => {
    const budget = computeDelphiCaptionBudget({
      ...mobileBase,
      captionAllocatedHeightPx: 103,
    });

    expect(delphiScrollCharBudget(budget)).toBe(budget.scrollMaxLines * budget.maxCharsPerLine);
  });
});

describe("computeCaptionAllocatedHeightPx", () => {
  test("subtracts dock, padding, particle reserve from viewport", () => {
    const allocated = computeCaptionAllocatedHeightPx({
      viewportHeightPx: 852,
      dockHeightPx: 238,
      shellTopPaddingPx: 24,
      captionMarginPx: 16,
      particleMinReservePx: 360,
      safeAreaBottomPx: 0,
    });

    expect(allocated).toBe(852 - 238 - 24 - 16 - 360);
  });
});

describe("estimatePhysicalScreenInches", () => {
  test("converts css pixels via 96 ppi heuristic", () => {
    const { physicalWidthIn, physicalHeightIn } = estimatePhysicalScreenInches(1179, 2556, 3);

    expect(physicalWidthIn).toBeCloseTo(393 / 96, 1);
    expect(physicalHeightIn).toBeCloseTo(852 / 96, 1);
  });
});

describe("resolveDeviceLabel", () => {
  test("labels iPhone UA", () => {
    expect(resolveDeviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", "mobile")).toMatch(
      /iPhone/i
    );
  });

  test("falls back to tier when UA unknown", () => {
    expect(resolveDeviceLabel(undefined, "desktop")).toBe("desktop browser");
  });
});
