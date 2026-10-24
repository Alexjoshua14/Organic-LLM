import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Glass bar geometry for the voice drawer — built, not loaded.
 *
 * ## Why not the ReactBits `bar.glb`
 *
 * The first FluidGlass pass loaded ReactBits' bar model and stretched its middle to fit the
 * drawer. Under an opaque material that model looks fine. Under `MeshTransmissionMaterial` it
 * showed a hard vertical seam near the right end, fixed in place while the light moved. The mesh
 * itself is the cause — it is not a symmetric bar:
 *
 * | Region   | Left      | Right      |
 * |----------|-----------|------------|
 * | End cap  | 190 tris  | 902 tris   |
 * | Shoulder | 0 tris    | 144 tris   |
 *
 * The right end carries overlapping shells from an export merge, including an inward-facing cap
 * inside the bar (x ≈ 2.32–2.70, |normal.x| up to 0.95), and the whole mesh has 482 non-manifold
 * edges. A transmissive material lets the viewer see through the shell to all of it. At the
 * model's native ~7:1 proportion over the demo's busy photographs this is masked; stretched to a
 * ~28:1 drawer over a smooth light field, every internal face shows.
 *
 * A procedural bar is closed, manifold, and symmetric by construction, is sized directly in world
 * units (no stretch hack), and costs no network fetch or loader. The FluidGlass look comes from
 * the rendering pipeline — offscreen scene, framebuffer, transmission — which is unchanged.
 */

/** Edge rounding, as a fraction of bar height: how far in from the silhouette the bevel starts. */
export const GLASS_BEVEL_SIZE_RATIO = 0.2;

/** Bevel depth, as a fraction of bar height. Sets how domed the edge reads under refraction. */
export const GLASS_BEVEL_THICKNESS_RATIO = 0.2;

/** Core slab depth between the two bevels, as a fraction of bar height. */
export const GLASS_CORE_DEPTH_RATIO = 0.2;

/** Silhouette corner radius, as a fraction of bar height. */
export const GLASS_CORNER_RADIUS_RATIO = 0.34;

/** Bevel smoothness. Refraction magnifies faceting, so this is higher than an opaque mesh needs. */
export const GLASS_BEVEL_SEGMENTS = 8;
export const GLASS_CURVE_SEGMENTS = 10;

/**
 * ReactBits' bar mode uses `thickness: 10` on a model 1.2 units tall. Transmission thickness is
 * scaled by the mesh's world scale, so that setting refracted in proportion to bar height. Built
 * in world units at scale 1, the equivalent is this ratio times the height.
 */
export const GLASS_THICKNESS_PER_HEIGHT = 10 / 1.2;

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

/**
 * A rounded, bevel-domed glass bar whose outer silhouette is exactly `width × height`, centred on
 * the origin, facing +Z.
 *
 * Vertices are welded and normals recomputed so the bevel shades as one continuous curve —
 * faceted normals would refract as visible bands, which is the class of defect this replaces.
 */
export function createGlassBarGeometry(width: number, height: number): THREE.BufferGeometry {
  const bevelSize = height * GLASS_BEVEL_SIZE_RATIO;
  // The bevel grows the silhouette outward by `bevelSize`, so the shape is inset to compensate.
  const coreWidth = Math.max(height * 0.01, width - bevelSize * 2);
  const coreHeight = Math.max(height * 0.01, height - bevelSize * 2);
  const shape = roundedRectShape(
    coreWidth,
    coreHeight,
    Math.max(0, height * GLASS_CORNER_RADIUS_RATIO - bevelSize)
  );

  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: height * GLASS_CORE_DEPTH_RATIO,
    bevelEnabled: true,
    bevelSize,
    bevelThickness: height * GLASS_BEVEL_THICKNESS_RATIO,
    bevelSegments: GLASS_BEVEL_SEGMENTS,
    curveSegments: GLASS_CURVE_SEGMENTS,
    steps: 1,
  });

  // UVs differ across the extrude's side/cap seams and would stop the weld; glass does not use them.
  extruded.deleteAttribute("uv");
  extruded.deleteAttribute("normal");

  const geometry = mergeVertices(extruded);

  extruded.dispose();
  geometry.computeVertexNormals();
  geometry.center();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
