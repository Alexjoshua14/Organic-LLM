import { describe, expect, test } from "bun:test";
import * as THREE from "three";

import {
  createGlassBarGeometry,
  GLASS_THICKNESS_PER_HEIGHT,
} from "@/components/voice/voice-glass-geometry";

/** Drawer-like proportions: a wide desktop strip and a narrow phone strip, in world units. */
const SIZES: Array<[number, number]> = [
  [5.6, 0.2],
  [2.4, 0.2],
  [5.6, 0.69],
];

function bounds(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();

  return geometry.boundingBox!;
}

/** Edges used by exactly one triangle (holes) and by more than two (overlapping shells). */
function edgeDefects(geometry: THREE.BufferGeometry) {
  const index = geometry.index!;
  const count = new Map<string, number>();

  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];

    for (const [a, b] of [
      [tri[0]!, tri[1]!],
      [tri[1]!, tri[2]!],
      [tri[2]!, tri[0]!],
    ]) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;

      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }

  let open = 0;
  let nonManifold = 0;

  for (const n of count.values()) {
    if (n === 1) open++;
    if (n > 2) nonManifold++;
  }

  return { open, nonManifold };
}

describe("createGlassBarGeometry", () => {
  test.each(SIZES)("silhouette is exactly %p × %p", (width, height) => {
    const box = bounds(createGlassBarGeometry(width, height));

    expect(box.max.x - box.min.x).toBeCloseTo(width, 4);
    expect(box.max.y - box.min.y).toBeCloseTo(height, 4);
  });

  test.each(SIZES)("is centred and mirror-symmetric at %p × %p", (width, height) => {
    const box = bounds(createGlassBarGeometry(width, height));

    // The defect this replaces was a model with ~5× the geometry at one end.
    expect(box.min.x).toBeCloseTo(-box.max.x, 5);
    expect(box.min.y).toBeCloseTo(-box.max.y, 5);
    expect(box.min.z).toBeCloseTo(-box.max.z, 5);
  });

  test("puts the same amount of geometry at each end", () => {
    const geometry = createGlassBarGeometry(5.6, 0.2);
    const position = geometry.getAttribute("position");
    const box = bounds(geometry);
    const capZone = (box.max.x - box.min.x) * 0.1;
    let left = 0;
    let right = 0;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);

      if (x < box.min.x + capZone) left++;
      if (x > box.max.x - capZone) right++;
    }

    expect(left).toBe(right);
  });

  test.each(SIZES)("is a closed, manifold shell at %p × %p", (width, height) => {
    // Under transmission every internal face or hole is visible; the shell must be clean.
    expect(edgeDefects(createGlassBarGeometry(width, height))).toEqual({ open: 0, nonManifold: 0 });
  });

  test("has welded, unit-length normals so the bevel shades as one curve", () => {
    const geometry = createGlassBarGeometry(5.6, 0.2);
    const normal = geometry.getAttribute("normal");
    const n = new THREE.Vector3();

    expect(geometry.index).not.toBeNull();

    for (let i = 0; i < normal.count; i++) {
      n.fromBufferAttribute(normal, i);
      expect(n.length()).toBeCloseTo(1, 4);
    }
  });

  test("has no UVs to break the weld", () => {
    expect(createGlassBarGeometry(5.6, 0.2).getAttribute("uv")).toBeUndefined();
  });

  test("degenerate sizes still produce valid geometry", () => {
    const box = bounds(createGlassBarGeometry(0.01, 0.2));

    expect(Number.isFinite(box.max.x)).toBe(true);
    expect(box.max.y - box.min.y).toBeGreaterThan(0);
  });
});

describe("GLASS_THICKNESS_PER_HEIGHT", () => {
  test("matches ReactBits' thickness 10 on its 1.2-unit bar", () => {
    // Transmission thickness scales with mesh world scale, so the demo's setting is
    // proportional to bar height; at 1.2 units tall this reproduces it exactly.
    expect(GLASS_THICKNESS_PER_HEIGHT * 1.2).toBeCloseTo(10, 6);
  });
});
