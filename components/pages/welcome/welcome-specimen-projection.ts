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
  const [c0, c1, c2, c3] = dark ? frame.darkCorners : frame.corners;
  const scale = ([x, y]: Point): Point => [x * ratio, y * ratio];
  const [p0, p1, p2, p3] = [scale(c0), scale(c1), scale(c2), scale(c3)];
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

/**
 * CSS form of `specimenPaneMatrix` that holds at any pane width, so the server-rendered pane
 * is projected in the first frame. The width-dependent terms become a percentage translate
 * and `perspective(100cqw)`; the pane's parent must be an inline-size container.
 */
export function specimenPaneTransform(mobile: boolean, dark = false): string {
  const frame = mobile ? SPECIMEN_FRAMES.mobile : SPECIMEN_FRAMES.desktop;
  const m = specimenPaneMatrix(frame.width, mobile, dark);
  const [tx, ty] = [m[12]!, m[13]!];
  const [gx, gy] = [m[3]! * frame.width, m[7]! * frame.width];
  const linear = [
    [m[0]! - tx * m[3]!, m[1]! - ty * m[3]!, -gx, 0],
    [m[4]! - tx * m[7]!, m[5]! - ty * m[7]!, -gy, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ].flat();
  const percent = (value: number) => `${(value / frame.width) * 100}%`;

  return `translate(${percent(tx)}, ${percent(ty)}) perspective(100cqw) matrix3d(${linear.join(",")})`;
}
