type Point = readonly [number, number];
type PaneCorners = readonly [Point, Point, Point, Point];

export const SPECIMEN_FRAMES = {
  desktop: {
    width: 1586,
    height: 992,
    corners: [
      [584, 92],
      [1249, 108],
      [1248, 806],
      [584, 754],
    ] as PaneCorners,
    darkCorners: [
      [584, 90],
      [1249, 105],
      [1248, 806],
      [584, 752],
    ] as PaneCorners,
  },
  mobile: {
    width: 780,
    height: 1688,
    corners: [
      [90, 274],
      [703, 291],
      [703, 948],
      [91, 898],
    ] as PaneCorners,
    darkCorners: [
      [92, 268],
      [700, 283],
      [699, 939],
      [94, 885],
    ] as PaneCorners,
  },
} as const;

/** Project a square dot surface onto the photographed pane's four corners. */
export function specimenPaneMatrix(width: number, mobile: boolean, dark = false): number[] {
  const frame = mobile ? SPECIMEN_FRAMES.mobile : SPECIMEN_FRAMES.desktop;
  const ratio = width / frame.width;
  const corners = dark ? frame.darkCorners : frame.corners;
  const [p0, p1, p2, p3] = corners.map(([x, y]) => [x * ratio, y * ratio]) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const dx1 = p1[0] - p2[0];
  const dx2 = p3[0] - p2[0];
  const dx3 = p0[0] - p1[0] + p2[0] - p3[0];
  const dy1 = p1[1] - p2[1];
  const dy2 = p3[1] - p2[1];
  const dy3 = p0[1] - p1[1] + p2[1] - p3[1];
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;

  return [
    (p1[0] - p0[0] + g * p1[0]) / width,
    (p1[1] - p0[1] + g * p1[1]) / width,
    0,
    g / width,
    (p3[0] - p0[0] + h * p3[0]) / width,
    (p3[1] - p0[1] + h * p3[1]) / width,
    0,
    h / width,
    0,
    0,
    1,
    0,
    p0[0],
    p0[1],
    0,
    1,
  ];
}
