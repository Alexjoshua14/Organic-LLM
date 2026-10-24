import { describe, expect, test } from "bun:test";

import {
  ERGON_LAB_NARROW_MAX_PX,
  ERGON_LAB_SHORT_MAX_PX,
  ergonBoardLabLayout,
} from "@/app/sandbox/prototypes/ergon/_components/ergon-board-lab-layout";

describe("ergonBoardLabLayout", () => {
  test("Tailwind narrow variants stay in sync with ERGON_LAB_NARROW_MAX_PX", () => {
    expect(ERGON_LAB_NARROW_MAX_PX).toBe(720);
    expect(ergonBoardLabLayout.chrome).toContain(`max-[${ERGON_LAB_NARROW_MAX_PX}px]:`);
    expect(ergonBoardLabLayout.widthControl).toContain(`min-[${ERGON_LAB_NARROW_MAX_PX + 1}px]:`);
    expect(ergonBoardLabLayout.chromeTransport).toContain(`max-[${ERGON_LAB_NARROW_MAX_PX}px]:`);
  });

  test("Tailwind short-viewport variants stay in sync with ERGON_LAB_SHORT_MAX_PX", () => {
    expect(ERGON_LAB_SHORT_MAX_PX).toBe(500);

    const shortMedia = `[@media(max-height:${ERGON_LAB_SHORT_MAX_PX}px)]:`;

    expect(ergonBoardLabLayout.chrome).toContain(shortMedia);
    expect(ergonBoardLabLayout.boardScrollerShort).toContain(shortMedia);
    expect(ergonBoardLabLayout.legacyScroller).toContain(shortMedia);
  });
});
