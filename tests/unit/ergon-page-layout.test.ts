import { describe, expect, test } from "bun:test";

import {
  ERGON_PAGE_NARROW_MAX_PX,
  ERGON_PAGE_SHORT_MAX_PX,
  ergonPageLayout,
} from "@/components/ergon/ergon-page-layout";

describe("ergonPageLayout", () => {
  test("Tailwind narrow variants stay in sync with ERGON_PAGE_NARROW_MAX_PX", () => {
    expect(ERGON_PAGE_NARROW_MAX_PX).toBe(767);
    expect(ergonPageLayout.taskColumn).toContain(`max-[${ERGON_PAGE_NARROW_MAX_PX}px]:`);
    expect(ergonPageLayout.boardGlass).toContain(`max-[${ERGON_PAGE_NARROW_MAX_PX}px]:`);
    expect(ergonPageLayout.shell).toContain("overflow-x-hidden");
    expect(ergonPageLayout.main).toContain("overflow-x-hidden");
  });

  test("short-viewport media stays in sync with ERGON_PAGE_SHORT_MAX_PX", () => {
    expect(ERGON_PAGE_SHORT_MAX_PX).toBe(500);
    expect(ergonPageLayout.header).toContain(`[@media(max-height:${ERGON_PAGE_SHORT_MAX_PX}px)]:`);
  });
});
