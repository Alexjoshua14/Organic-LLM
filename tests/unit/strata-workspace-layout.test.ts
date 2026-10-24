import { describe, expect, test } from "bun:test";

import {
  STRATA_ASSISTANT_PANEL_WIDTH_PX,
  STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX,
  STRATA_MAIN_MIN_MEASURE_PX,
  STRATA_SHORT_VIEWPORT_MAX_HEIGHT_PX,
  strataBrowserChrome,
  strataUsesSideBySideAssistant,
  strataWorkspaceChrome,
} from "@/lib/strata/workspace-layout";

describe("strataUsesSideBySideAssistant", () => {
  test("rejects non-positive and non-finite widths", () => {
    expect(strataUsesSideBySideAssistant(0)).toBe(false);
    expect(strataUsesSideBySideAssistant(-1)).toBe(false);
    expect(strataUsesSideBySideAssistant(Number.NaN)).toBe(false);
  });

  test("overlays below the dock breakpoint (phone + short landscape)", () => {
    expect(strataUsesSideBySideAssistant(390)).toBe(false);
    expect(strataUsesSideBySideAssistant(844)).toBe(false);
    expect(strataUsesSideBySideAssistant(STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX - 1)).toBe(
      false
    );
  });

  test("docks once main + panel fit at lg", () => {
    expect(strataUsesSideBySideAssistant(STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX)).toBe(true);
    expect(strataUsesSideBySideAssistant(1280)).toBe(true);
  });

  test("breakpoint leaves room for a readable main column beside the panel", () => {
    expect(STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX).toBe(1024);
    expect(
      STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX - STRATA_ASSISTANT_PANEL_WIDTH_PX
    ).toBeGreaterThanOrEqual(STRATA_MAIN_MIN_MEASURE_PX);
  });
});

describe("strata workspace chrome class sync", () => {
  test("root / aside encode the lg dock breakpoint and dvh overlay", () => {
    expect(strataWorkspaceChrome.root).toContain("lg:flex-row");
    expect(strataWorkspaceChrome.root).toContain("overflow-x-hidden");
    expect(strataWorkspaceChrome.aside).toContain("lg:static");
    expect(strataWorkspaceChrome.aside).toContain("h-dvh");
    expect(strataWorkspaceChrome.aside).toContain("safe-area-inset");
    expect(strataWorkspaceChrome.aside).toContain("fixed");
  });

  test("browser chrome hides blurb on short viewports", () => {
    expect(STRATA_SHORT_VIEWPORT_MAX_HEIGHT_PX).toBe(500);
    expect(strataBrowserChrome.hideOnShortViewport).toContain(
      `max-height:${STRATA_SHORT_VIEWPORT_MAX_HEIGHT_PX}px`
    );
    expect(strataBrowserChrome.root).toContain("overflow-x-hidden");
    expect(strataBrowserChrome.root).toContain("safe-area-inset-bottom");
  });
});
