import * as THREE from "three";

/** Deterministic [0, 1) hash from particle index + salt (stable across renders). */
function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt) * 43758.5453;
  return x - Math.floor(x);
}

/** Signed distance to a rounded axis-aligned box (Iñigo Quilez). */
function sdRoundedBox(p: THREE.Vector3, b: THREE.Vector3, r: number): number {
  const q = new THREE.Vector3(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)).sub(b);

  const qx = Math.max(q.x, 0);
  const qy = Math.max(q.y, 0);
  const qz = Math.max(q.z, 0);
  const outside = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const inside = Math.min(Math.max(q.x, q.y, q.z), 0);

  return outside + inside - r;
}

/** Ray from origin along `dir` (unit); binary-search t where SDF ≈ 0. */
function surfacePointOnRoundedBox(
  dir: THREE.Vector3,
  half: THREE.Vector3,
  radius: number,
  tMax = 24
): THREE.Vector3 {
  const d = dir.clone().normalize();
  let lo = 0.001;
  let hi = tMax;

  for (let j = 0; j < 28; j++) {
    const mid = (lo + hi) * 0.5;
    const p = d.clone().multiplyScalar(mid);
    const s = sdRoundedBox(p, half, radius);

    if (s > 0) hi = mid;
    else lo = mid;
  }

  return d.multiplyScalar((lo + hi) * 0.5);
}

/**
 * Stable rest positions: rounded-cube–biased cloud (thick fuzzy shell + tangential
 * scatter) + normalized ids in [0, 1]. Softer corners and volume spread so the
 * silhouette reads amorphous rather than a thin shell.
 */
export function buildRoundedCubeRest(count: number): {
  positions: Float32Array;
  ids: Float32Array;
} {
  const positions = new Float32Array(count * 3);
  const ids = new Float32Array(count);
  const half = new THREE.Vector3(3.2, 3.2, 3.2);
  const cornerRadius = 1.8;
  const radialMin = 0.82;
  const radialSpan = 0.36;
  const tangentialAmp = 1.2;
  const dir = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const t = i + 0.5;
    const y = 1 - (2 * t) / count;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = Math.PI * (3 - Math.sqrt(5)) * t;

    dir.set(Math.cos(theta) * rr, y, Math.sin(theta) * rr);
    const p = surfacePointOnRoundedBox(dir, half, cornerRadius);

    const radialJitter = radialMin + hash01(i, 0) * radialSpan;
    p.multiplyScalar(radialJitter);
    p.x += (hash01(i, 1.7) - 0.5) * tangentialAmp;
    p.y += (hash01(i, 5.3) - 0.5) * tangentialAmp;
    p.z += (hash01(i, 9.1) - 0.5) * tangentialAmp;

    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    ids[i] = count > 1 ? i / (count - 1) : 0;
  }

  return { positions, ids };
}
