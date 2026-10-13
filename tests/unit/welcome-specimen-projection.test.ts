import { expect, test } from "bun:test";

import { specimenPaneMatrix } from "@/components/pages/welcome/welcome-specimen-projection";

function project(matrix: number[], x: number, y: number) {
  const depth = matrix[3]! * x + matrix[7]! * y + matrix[15]!;

  return [
    (matrix[0]! * x + matrix[4]! * y + matrix[12]!) / depth,
    (matrix[1]! * x + matrix[5]! * y + matrix[13]!) / depth,
  ];
}

test("desktop dot surface meets all four photographed glass corners at different sizes", () => {
  const corners = [
    [584, 92],
    [1249, 108],
    [1248, 806],
    [584, 754],
  ];

  for (const width of [960, 1586, 2048]) {
    const matrix = specimenPaneMatrix(width, false);
    const surface = [
      [0, 0],
      [width, 0],
      [width, width],
      [0, width],
    ];

    surface.forEach(([x, y], index) => {
      const point = project(matrix, x!, y!);

      expect(point[0]).toBeCloseTo((corners[index]![0]! * width) / 1586, 6);
      expect(point[1]).toBeCloseTo((corners[index]![1]! * width) / 1586, 6);
    });
  }
});

test("mobile projection follows each theme's own glass geometry", () => {
  const themes = [
    {
      dark: false,
      corners: [
        [90, 274],
        [703, 291],
        [703, 948],
        [91, 898],
      ],
    },
    {
      dark: true,
      corners: [
        [92, 268],
        [700, 283],
        [699, 939],
        [94, 885],
      ],
    },
  ];
  const width = 390;
  const surface = [
    [0, 0],
    [width, 0],
    [width, width],
    [0, width],
  ];

  for (const { dark, corners } of themes) {
    const matrix = specimenPaneMatrix(width, true, dark);

    surface.forEach(([x, y], index) => {
      const point = project(matrix, x!, y!);

      expect(point[0]).toBeCloseTo(corners[index]![0]! / 2, 6);
      expect(point[1]).toBeCloseTo(corners[index]![1]! / 2, 6);
    });
  }
});

test("dot rows slope with the angled pane instead of facing straight forward", () => {
  const matrix = specimenPaneMatrix(1586, false);
  const left = project(matrix, 1586 * 0.1, 1586 * 0.5);
  const right = project(matrix, 1586 * 0.9, 1586 * 0.5);

  expect(right[1]! - left[1]!).toBeGreaterThan(20);
  expect(right[0]! - left[0]!).toBeGreaterThan(500);
});
