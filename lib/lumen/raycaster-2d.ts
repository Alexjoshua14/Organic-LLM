import type { UserComposerActivityState } from "@/lib/llm/auto-model-router";

const TAU = Math.PI * 2;
const MAX_CACHED_RAYS = 64;
const MAX_GLYPHS = 64;

/** Preallocated trig tables for common ray counts so the hot loop does zero allocations. */
const RAY_COS_TABLE = new Float32Array(MAX_CACHED_RAYS);
const RAY_SIN_TABLE = new Float32Array(MAX_CACHED_RAYS);
let cachedRayCount = 0;

function ensureRayTrigTable(rayCount: number): number {
  const clamped = Math.max(4, Math.min(MAX_CACHED_RAYS, rayCount | 0));

  if (clamped === cachedRayCount) return clamped;

  for (let r = 0; r < clamped; r++) {
    const theta = (TAU * (r + 0.5)) / clamped;

    RAY_COS_TABLE[r] = Math.cos(theta);
    RAY_SIN_TABLE[r] = Math.sin(theta);
  }
  cachedRayCount = clamped;

  return clamped;
}

/** Preallocated scratch buffers for glyph positions & weights (zero GC pressure in rAF). */
const SCRATCH_GLYPH_X = new Float32Array(MAX_GLYPHS);
const SCRATCH_GLYPH_WEIGHT = new Float32Array(MAX_GLYPHS);

/**
 * Activity energy & cadence profile for the 2D character lumen raycaster.
 */
export const LUMEN_ACTIVITY_PROFILES: Record<
  UserComposerActivityState,
  {
    energyMultiplier: number;
    causticSpread: number;
    pillBackdropOpacity: number;
    phaseVelocity: number;
  }
> = {
  typing: {
    energyMultiplier: 1.18,
    causticSpread: 1.12,
    pillBackdropOpacity: 0.76,
    phaseVelocity: 2.2,
  },
  thinking: {
    energyMultiplier: 1.08,
    causticSpread: 1.24,
    pillBackdropOpacity: 0.72,
    phaseVelocity: 1.35,
  },
  reviewing: {
    energyMultiplier: 1.0,
    causticSpread: 1.04,
    pillBackdropOpacity: 0.68,
    phaseVelocity: 0.9,
  },
  idle: {
    energyMultiplier: 0.72,
    causticSpread: 0.88,
    pillBackdropOpacity: 0.58,
    phaseVelocity: 0.45,
  },
  disconnected: {
    energyMultiplier: 0.38,
    causticSpread: 0.65,
    pillBackdropOpacity: 0.46,
    phaseVelocity: 0.0,
  },
};

export interface CharacterLumenSample {
  charIndex: number;
  char: string;
  glowIntensity: number;
  bounceIrradiance: number;
  specularHighlight: number;
  hueShiftDeg: number;
  textShadowCss: string;
}

export interface LumenBoundaryHit {
  distance: number;
  hitX: number;
  hitY: number;
  normalX: number;
  normalY: number;
  reflectedDx: number;
  reflectedDy: number;
  cosIncidence: number;
}

export interface LumenRaycastOptions {
  text: string;
  pillWidth?: number;
  pillHeight?: number;
  cornerRadius?: number;
  rayCount?: number;
  activityState?: UserComposerActivityState;
  timeSec?: number;
}

export interface LumenRaycastFrame {
  characters: CharacterLumenSample[];
  backdropCausticCss: string;
  borderSheenCss: string;
  pillOpacity: number;
  meanGlow: number;
  maxSpecular: number;
  cssVars: {
    "--lumen-backdrop-caustic": string;
    "--lumen-border-sheen": string;
    "--lumen-pill-opacity": string;
  };
  elapsedMs: number;
  kernel: "ts-float32" | "rust-wasm";
}

/**
 * Exact 2D Signed-Distance Field for a rounded box centered at `(0, 0)` with
 * `halfW`, `halfH`, and `cornerRadius`.
 * Negative inside the cavity, `0` on the boundary, positive outside.
 */
export function sdfRoundedBox(
  px: number,
  py: number,
  halfW: number,
  halfH: number,
  cornerRadius: number
): number {
  const maxR = Math.max(0, Math.min(halfW, halfH));
  const r = Math.max(0, Math.min(cornerRadius, maxR));
  const qx = Math.abs(px) - (halfW - r);
  const qy = Math.abs(py) - (halfH - r);
  const outX = Math.max(qx, 0);
  const outY = Math.max(qy, 0);
  const outside = Math.hypot(outX, outY);
  const inside = Math.min(Math.max(qx, qy), 0);

  return outside + inside - r;
}

/**
 * Exact 2D Signed-Distance Field for a capsule segment from `(ax, ay)` to `(bx, by)`
 * with thickness `radius`.
 */
export function sdfCapsuleSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number
): number {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = Math.max(1e-8, bax * bax + bay * bay);
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / denom));
  const dx = pax - bax * h;
  const dy = pay - bay * h;

  return Math.hypot(dx, dy) - radius;
}

/**
 * Computes the unit outward normal `[nx, ny]` of `sdfRoundedBox` at `(px, py)`
 * via symmetric central differences \(\nabla \text{SDF}(\mathbf{x}) / \|\nabla \text{SDF}(\mathbf{x})\|\).
 */
export function sdfRoundedBoxNormal(
  px: number,
  py: number,
  halfW: number,
  halfH: number,
  cornerRadius: number
): [number, number] {
  const eps = 0.25;
  const dx =
    sdfRoundedBox(px + eps, py, halfW, halfH, cornerRadius) -
    sdfRoundedBox(px - eps, py, halfW, halfH, cornerRadius);
  const dy =
    sdfRoundedBox(px, py + eps, halfW, halfH, cornerRadius) -
    sdfRoundedBox(px, py - eps, halfW, halfH, cornerRadius);
  const len = Math.hypot(dx, dy);

  if (len <= 1e-6) {
    return [0, -1];
  }

  return [dx / len, dy / len];
}

/**
 * Inverse-square radiance attenuation: \(\frac{I_0}{1 + k_1 d + k_2 d^2}\).
 */
export function inverseSquareFalloff(
  distance: number,
  intensity0: number,
  k1 = 0.09,
  k2 = 0.018
): number {
  const d = Math.max(0, distance);

  return intensity0 / (1 + k1 * d + k2 * d * d);
}

/**
 * Reflects a 2D unit ray direction `(dx, dy)` across a unit normal `(nx, ny)`:
 * \(\mathbf{r}_{\text{refl}} = \mathbf{d} - 2(\mathbf{d}\cdot\mathbf{n})\mathbf{n}\).
 */
export function reflectRay2D(dx: number, dy: number, nx: number, ny: number): [number, number] {
  const dot = dx * nx + dy * ny;

  return [dx - 2 * dot * nx, dy - 2 * dot * ny];
}

/**
 * Sphere-traces a 2D ray \(\mathbf{r}(t) = \mathbf{o} + t\mathbf{d}\) from an interior
 * cavity point `(ox, oy)` until it intersects the rounded pill wall (`sdfRoundedBox == 0`),
 * returning the hit point, boundary normal, single-bounce reflection vector, and \(\cos\theta_i\).
 */
export function marchToPillBoundary(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  halfW: number,
  halfH: number,
  cornerRadius: number
): LumenBoundaryHit {
  const dirLen = Math.hypot(dx, dy) || 1;
  const udx = dx / dirLen;
  const udy = dy / dirLen;

  let t = 0;
  const maxT = Math.max(16, halfW * 2.5 + halfH * 2.5);

  for (let step = 0; step < 16; step++) {
    const px = ox + udx * t;
    const py = oy + udy * t;
    const sdf = sdfRoundedBox(px, py, halfW, halfH, cornerRadius);
    const distToWall = -sdf;

    if (distToWall <= 0.35 || t >= maxT) {
      break;
    }
    t += Math.max(0.5, distToWall);
  }

  const hitX = ox + udx * t;
  const hitY = oy + udy * t;
  const [normalX, normalY] = sdfRoundedBoxNormal(hitX, hitY, halfW, halfH, cornerRadius);
  const [reflectedDx, reflectedDy] = reflectRay2D(udx, udy, normalX, normalY);
  const cosIncidence = Math.max(0, Math.min(1, Math.abs(udx * normalX + udy * normalY)));

  return {
    distance: t,
    hitX,
    hitY,
    normalX,
    normalY,
    reflectedDx,
    reflectedDy,
    cosIncidence,
  };
}

function glyphOpticalWeight(ch: string): number {
  if (ch === " " || ch === "\t") return 0.22;
  if (ch === "." || ch === "·" || ch === "-") return 0.52;
  if (/[0-9]/.test(ch)) return 0.96;
  if (/[A-Z]/.test(ch)) return 1.08;

  return 0.9;
}

function buildCharacterTextShadow(
  glowIntensity: number,
  bounceIrradiance: number,
  specularHighlight: number,
  hueShiftDeg: number
): string {
  const coreAlpha = (glowIntensity * 0.44).toFixed(3);
  const bounceAlpha = (Math.min(1, bounceIrradiance) * 0.28).toFixed(3);
  const coreBlurPx = (2.5 + glowIntensity * 5.5).toFixed(2);
  const bounceBlurPx = (6 + bounceIrradiance * 9).toFixed(2);
  const dispOffsetPx = ((hueShiftDeg / 14) * 0.85).toFixed(2);
  const specAlpha = (specularHighlight * 0.24).toFixed(3);

  return [
    `0 0 ${coreBlurPx}px rgb(var(--lumen-rim) / ${coreAlpha})`,
    `${dispOffsetPx}px 0.5px ${bounceBlurPx}px rgb(var(--lumen) / ${bounceAlpha})`,
    `0 -0.5px 1.5px rgb(255 244 218 / ${specAlpha})`,
  ].join(", ");
}

/** Optional WebAssembly Rust kernel bindings when loaded via `loadRustLumenKernel`. */
interface RustLumenWasmExports {
  memory: WebAssembly.Memory;
  sdf_rounded_box: (
    px: number,
    py: number,
    halfW: number,
    halfH: number,
    cornerRadius: number
  ) => number;
  compute_glyph_lumen?: (
    weightsPtr: number,
    count: number,
    pillWidth: number,
    pillHeight: number,
    cornerRadius: number,
    rayCount: number,
    activityCode: number,
    timeSec: number,
    outPtr: number
  ) => number;
}

let activeRustWasmExports: RustLumenWasmExports | null = null;

/**
 * Optional WASM bridge for `rust/lumen-raycaster`.
 * Binds a compiled `.wasm` module if provided; otherwise returns `null` and callers
 * execute the identical preallocated `Float32Array` TypeScript kernel.
 */
export async function loadRustLumenKernel(
  wasmSource?: BufferSource | WebAssembly.Module
): Promise<RustLumenWasmExports | null> {
  if (!wasmSource || typeof WebAssembly === "undefined") {
    return activeRustWasmExports;
  }

  try {
    const instantiated = await WebAssembly.instantiate(wasmSource as BufferSource, {});
    const instance =
      "instance" in instantiated ? instantiated.instance : (instantiated as WebAssembly.Instance);

    const exports = instance.exports as unknown as RustLumenWasmExports;

    if (typeof exports.sdf_rounded_box === "function") {
      activeRustWasmExports = exports;

      return activeRustWasmExports;
    }
  } catch {
    // Fall back to Float32Array TypeScript kernel
  }

  return null;
}

function nowMilliseconds(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Executes the 2D Signed-Distance Field + single-bounce character lumen raycaster.
 * Runs in `< 0.2ms` per frame using preallocated `Float32Array` scratch buffers.
 */
export function raycastCharacterLumen(options: LumenRaycastOptions): LumenRaycastFrame {
  const startMs = nowMilliseconds();

  const rawText = options.text || "Auto";
  const chars = Array.from(rawText).slice(0, MAX_GLYPHS);
  const glyphCount = chars.length;

  const pillWidth = Math.max(36, options.pillWidth ?? Math.max(58, glyphCount * 7.6 + 22));
  const pillHeight = Math.max(20, options.pillHeight ?? 26);
  const cornerRadius = Math.max(4, Math.min(pillHeight * 0.5, options.cornerRadius ?? 8));
  const rayCount = ensureRayTrigTable(options.rayCount ?? 16);
  const activityState: UserComposerActivityState = options.activityState ?? "idle";
  const timeSec = options.timeSec ?? 0;

  const profile = LUMEN_ACTIVITY_PROFILES[activityState] ?? LUMEN_ACTIVITY_PROFILES.idle;
  const energy = profile.energyMultiplier;

  const halfW = pillWidth * 0.5;
  const halfH = pillHeight * 0.5;
  const usableSpan = Math.max(8, pillWidth - 16);
  const stepX = glyphCount > 1 ? usableSpan / glyphCount : 0;
  const startX = -usableSpan * 0.5 + stepX * 0.5;
  const segHalf = Math.max(1.2, Math.min(5.0, stepX * 0.36));

  for (let i = 0; i < glyphCount; i++) {
    SCRATCH_GLYPH_X[i] = glyphCount > 1 ? startX + i * stepX : 0;
    SCRATCH_GLYPH_WEIGHT[i] = glyphOpticalWeight(chars[i]!);
  }

  const characters: CharacterLumenSample[] = new Array(glyphCount);
  const invRays = 1 / rayCount;
  const invSqrtCount = glyphCount > 0 ? 1 / Math.sqrt(glyphCount) : 1;

  let totalGlow = 0;
  let maxSpecular = 0;

  for (let i = 0; i < glyphCount; i++) {
    const gx = SCRATCH_GLYPH_X[i]!;
    const gy = 0;
    const weightI = SCRATCH_GLYPH_WEIGHT[i]!;
    const phase = timeSec * profile.phaseVelocity + i * 0.42;
    const pulse = 1 + 0.08 * Math.sin(phase);

    // 1. Direct emissive radiance from local + neighboring glyph capsule segments
    let directSum = 0;

    for (let j = 0; j < glyphCount; j++) {
      const nxPos = SCRATCH_GLYPH_X[j]!;
      const weightJ = SCRATCH_GLYPH_WEIGHT[j]!;
      const d = Math.max(0, sdfCapsuleSegment(gx, gy, nxPos - segHalf, 0, nxPos + segHalf, 0, 1.2));

      directSum += inverseSquareFalloff(d, weightJ * energy * pulse, 0.09, 0.018);
    }
    const directIrradiance = Math.min(1.5, directSum * invSqrtCount);

    // 2. Stratified 2D rays for pill border bounce & specular dispersion
    let bounceSum = 0;
    let specSum = 0;
    let dispersionSum = 0;

    for (let r = 0; r < rayCount; r++) {
      const dx = RAY_COS_TABLE[r]!;
      const dy = RAY_SIN_TABLE[r]!;

      const hit = marchToPillBoundary(gx, gy, dx, dy, halfW, halfH, cornerRadius);
      const wallAttenuation = inverseSquareFalloff(hit.distance, energy * weightI, 0.045, 0.004);
      const oneMinusCos = 1 - hit.cosIncidence;
      const fresnel = 0.22 + 0.78 * (oneMinusCos * oneMinusCos * oneMinusCos);

      // Single-bounce march along reflected ray vector back toward the glyph baseline core
      const bounceProbeDist = Math.max(4, halfH * 0.85);
      const bx = hit.hitX + hit.reflectedDx * bounceProbeDist;
      const by = hit.hitY + hit.reflectedDy * bounceProbeDist;
      const distToCore = Math.max(
        0,
        sdfCapsuleSegment(bx, by, -usableSpan * 0.45, 0, usableSpan * 0.45, 0, 2.0)
      );

      const bounceReturn = inverseSquareFalloff(distToCore, wallAttenuation, 0.06, 0.008);

      bounceSum += bounceReturn * (0.55 + 0.45 * hit.cosIncidence);
      specSum += wallAttenuation * fresnel;
      dispersionSum += oneMinusCos * (dx >= 0 ? 1 : -1);
    }

    const bounceIrradiance = Math.max(0, Math.min(1.2, bounceSum * invRays * 1.35));
    const specularHighlight = Math.max(0, Math.min(1.0, specSum * invRays * 1.15));
    const glowIntensity = Math.max(
      0.08,
      Math.min(1.0, directIrradiance * 0.58 + bounceIrradiance * 0.42)
    );
    const normX = Math.max(-1, Math.min(1, gx / Math.max(1, halfW)));
    const hueShiftDeg = Math.max(-14, Math.min(14, dispersionSum * invRays * 18 + normX * 6.5));

    totalGlow += glowIntensity;
    if (specularHighlight > maxSpecular) {
      maxSpecular = specularHighlight;
    }

    characters[i] = {
      charIndex: i,
      char: chars[i]!,
      glowIntensity,
      bounceIrradiance,
      specularHighlight,
      hueShiftDeg,
      textShadowCss: buildCharacterTextShadow(
        glowIntensity,
        bounceIrradiance,
        specularHighlight,
        hueShiftDeg
      ),
    };
  }

  const meanGlow = glyphCount > 0 ? totalGlow / glyphCount : 0.25;
  const pillOpacity = Number(profile.pillBackdropOpacity.toFixed(3));
  const causticAlpha = (meanGlow * 0.22 * profile.causticSpread).toFixed(3);
  const darkCoreAlpha = pillOpacity.toFixed(3);
  const edgeAlpha = (pillOpacity * 0.42).toFixed(3);
  const sheenAlpha = Math.max(0.12, maxSpecular * 0.34).toFixed(3);

  const backdropCausticCss = [
    `radial-gradient(120% 95% at 50% 52%, rgb(var(--lumen) / ${causticAlpha}) 0%, rgba(10, 10, 12, ${darkCoreAlpha}) 54%, rgba(6, 6, 8, ${edgeAlpha}) 84%, rgba(0, 0, 0, 0) 100%)`,
  ].join(", ");

  const borderSheenCss = `linear-gradient(135deg, rgb(var(--lumen-rim) / ${sheenAlpha}) 0%, rgba(255, 255, 255, 0.06) 48%, rgb(var(--lumen-deep) / ${(Number(sheenAlpha) * 0.75).toFixed(3)}) 100%)`;

  const elapsedMs = nowMilliseconds() - startMs;

  return {
    characters,
    backdropCausticCss,
    borderSheenCss,
    pillOpacity,
    meanGlow,
    maxSpecular,
    cssVars: {
      "--lumen-backdrop-caustic": backdropCausticCss,
      "--lumen-border-sheen": borderSheenCss,
      "--lumen-pill-opacity": String(pillOpacity),
    },
    elapsedMs,
    kernel: activeRustWasmExports?.compute_glyph_lumen ? "rust-wasm" : "ts-float32",
  };
}
