import { describe, expect, test } from "bun:test";

import {
  MORPH_DEMO_HUD_SIDE_MIN_WIDTH_PX,
  MORPH_DEMO_HUD_SIDE_WIDTH_PX,
  MORPH_DEMO_RAIL_WIDTH_PX,
  MORPH_DEMO_SHORT_VIEWPORT_MAX_HEIGHT_PX,
  morphDemoChrome,
  morphDemoHud,
  morphDemoRabbitRails,
} from "@/app/sandbox/prototypes/morphs/_lib/morph-demo-layout";

describe("morph-demo-layout", () => {
  test("HUD side dock breakpoint matches Tailwind sm classes", () => {
    expect(MORPH_DEMO_HUD_SIDE_MIN_WIDTH_PX).toBe(640);
    expect(morphDemoHud.openPanel).toContain("sm:right-0");
    expect(morphDemoHud.collapsedTab).toContain("sm:right-0");
  });

  test("HUD side width matches 18rem / max-w fragment", () => {
    expect(MORPH_DEMO_HUD_SIDE_WIDTH_PX).toBe(288);
    expect(morphDemoHud.openPanel).toContain("18rem");
  });

  test("short-viewport header hide uses documented max-height", () => {
    expect(MORPH_DEMO_SHORT_VIEWPORT_MAX_HEIGHT_PX).toBe(500);
    expect(morphDemoChrome.headerBody).toContain("max-height:500px");
  });

  test("page chrome forbids horizontal overflow and allows vertical scroll", () => {
    expect(morphDemoChrome.page).toContain("overflow-x-hidden");
    expect(morphDemoChrome.page).toContain("overflow-y-auto");
  });

  test("rabbit rails stack below lg and side-dock from lg", () => {
    expect(MORPH_DEMO_RAIL_WIDTH_PX).toBe(260);
    expect(morphDemoRabbitRails.sideLayer).toContain("hidden lg:block");
    expect(morphDemoRabbitRails.stack).toContain("lg:hidden");
    expect(morphDemoRabbitRails.sideRailWidth).toContain("260px");
  });
});
