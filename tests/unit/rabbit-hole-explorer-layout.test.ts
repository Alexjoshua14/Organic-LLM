import { describe, expect, test } from "bun:test";

import {
  RABBIT_HOLE_CENTER_MIN_MEASURE_PX,
  RABBIT_HOLE_GRID_GAP_PX,
  RABBIT_HOLE_SIDE_COLUMN_PX,
  RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX,
  rabbitHoleExplorerGrid,
  rabbitHoleUsesThreeColumnGrid,
} from "@/lib/rabbit-holes/explorer-layout";
import { layout } from "@/lib/rabbit-holes/designTokens";

describe("rabbitHoleUsesThreeColumnGrid", () => {
  test("rejects non-positive and non-finite widths", () => {
    expect(rabbitHoleUsesThreeColumnGrid(0)).toBe(false);
    expect(rabbitHoleUsesThreeColumnGrid(-100)).toBe(false);
    expect(rabbitHoleUsesThreeColumnGrid(Number.NaN)).toBe(false);
  });

  test("stacks when the main pane is portrait-narrow after the sidebar", () => {
    // 1080 portrait − 16rem sidebar − lg horizontal padding ≈ content box under threshold
    expect(rabbitHoleUsesThreeColumnGrid(728)).toBe(false);
    expect(rabbitHoleUsesThreeColumnGrid(RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX - 1)).toBe(false);
  });

  test("enables 3-col once center can keep a readable measure", () => {
    expect(rabbitHoleUsesThreeColumnGrid(RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX)).toBe(true);
    expect(rabbitHoleUsesThreeColumnGrid(1400)).toBe(true);
  });

  test("min width is side + center measure + side + two gaps", () => {
    expect(RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX).toBe(
      RABBIT_HOLE_SIDE_COLUMN_PX * 2 +
        RABBIT_HOLE_CENTER_MIN_MEASURE_PX +
        RABBIT_HOLE_GRID_GAP_PX * 2
    );
  });
});

describe("rabbitHoleExplorerGrid class sync", () => {
  test("container-query min width matches the pure threshold", () => {
    const needle = `@min-[${RABBIT_HOLE_THREE_COL_MIN_WIDTH_PX}px]`;

    expect(rabbitHoleExplorerGrid.display).toContain(needle);
    expect(rabbitHoleExplorerGrid.cols).toContain(needle);
    expect(rabbitHoleExplorerGrid.cols).toContain(`${RABBIT_HOLE_SIDE_COLUMN_PX}px`);
    expect(layout.gridCols).toBe(rabbitHoleExplorerGrid.cols);
    expect(layout.gridMaxWidth).toBe(rabbitHoleExplorerGrid.maxWidth);
  });
});
