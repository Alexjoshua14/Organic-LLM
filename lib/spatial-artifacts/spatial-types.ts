export type ArtifactPoint = { x: number; y: number };

export type ArtifactRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  center: ArtifactPoint;
  corners: [ArtifactPoint, ArtifactPoint, ArtifactPoint, ArtifactPoint];
};

export type ArtifactSpatialEntry = {
  artifactId: string;
  activeSlotKey: string | null;
  lastRect: ArtifactRect | null;
  targetRect: ArtifactRect | null;
  visible: boolean;
};

export function rectFromVector4(v: { x: number; y: number; w: number; h: number }): ArtifactRect {
  const x2 = v.x + v.w;
  const y2 = v.y + v.h;

  return {
    x: v.x,
    y: v.y,
    w: v.w,
    h: v.h,
    center: { x: v.x + v.w / 2, y: v.y + v.h / 2 },
    corners: [
      { x: v.x, y: v.y },
      { x: x2, y: v.y },
      { x: x2, y: y2 },
      { x: v.x, y: y2 },
    ],
  };
}

export function vector4FromRect(rect: ArtifactRect): { x: number; y: number; w: number; h: number } {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}
