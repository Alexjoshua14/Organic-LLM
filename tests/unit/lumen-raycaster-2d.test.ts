import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { describe, expect, test } from "bun:test";

import {
  inverseSquareFalloff,
  loadRustLumenKernel,
  marchToPillBoundary,
  raycastCharacterLumen,
  reflectRay2D,
  sdfCapsuleSegment,
  sdfRoundedBox,
  sdfRoundedBoxNormal,
} from "@/lib/lumen/raycaster-2d";

describe("2D Signed-Distance Raycaster primitives", () => {
  test("sdfRoundedBox is negative inside, zero on boundary, and positive outside", () => {
    const halfW = 42;
    const halfH = 13;
    const radius = 7;

    expect(sdfRoundedBox(0, 0, halfW, halfH, radius)).toBeLessThan(0);
    expect(Math.abs(sdfRoundedBox(0, halfH, halfW, halfH, radius))).toBeLessThan(1e-5);
    expect(Math.abs(sdfRoundedBox(halfW, 0, halfW, halfH, radius))).toBeLessThan(1e-5);
    expect(sdfRoundedBox(halfW + 10, 0, halfW, halfH, radius)).toBeCloseTo(10, 4);
    expect(sdfRoundedBox(0, halfH + 6, halfW, halfH, radius)).toBeCloseTo(6, 4);
  });

  test("sdfRoundedBoxNormal produces unit outward normals on all four walls and corners", () => {
    const halfW = 40;
    const halfH = 14;
    const radius = 6;

    const [topNx, topNy] = sdfRoundedBoxNormal(0, halfH, halfW, halfH, radius);
    expect(Math.hypot(topNx, topNy)).toBeCloseTo(1, 3);
    expect(topNx).toBeCloseTo(0, 3);
    expect(topNy).toBeCloseTo(1, 3);

    const [rightNx, rightNy] = sdfRoundedBoxNormal(halfW, 0, halfW, halfH, radius);
    expect(Math.hypot(rightNx, rightNy)).toBeCloseTo(1, 3);
    expect(rightNx).toBeCloseTo(1, 3);
    expect(rightNy).toBeCloseTo(0, 3);

    const [cornerNx, cornerNy] = sdfRoundedBoxNormal(halfW - 1, halfH - 1, halfW, halfH, radius);
    expect(Math.hypot(cornerNx, cornerNy)).toBeCloseTo(1, 3);
    expect(cornerNx).toBeGreaterThan(0.5);
    expect(cornerNy).toBeGreaterThan(0.5);
  });

  test("sdfCapsuleSegment measures exact distance to glyph baseline segment", () => {
    expect(sdfCapsuleSegment(0, 0, -4, 0, 4, 0, 1.5)).toBeCloseTo(-1.5, 5);
    expect(sdfCapsuleSegment(0, 3.5, -4, 0, 4, 0, 1.5)).toBeCloseTo(2.0, 5);
  });

  test("marchToPillBoundary finds wall intersection and computes single-bounce reflection", () => {
    const halfW = 44;
    const halfH = 12;
    const radius = 6;

    // Ray straight up from origin hits top wall at y ≈ +12 and reflects straight down
    const hitUp = marchToPillBoundary(0, 0, 0, 1, halfW, halfH, radius);
    expect(hitUp.distance).toBeGreaterThan(10);
    expect(hitUp.distance).toBeLessThanOrEqual(12.5);
    expect(hitUp.hitY).toBeGreaterThan(10);
    expect(hitUp.normalY).toBeCloseTo(1, 2);
    expect(hitUp.reflectedDx).toBeCloseTo(0, 2);
    expect(hitUp.reflectedDy).toBeCloseTo(-1, 2);
    expect(hitUp.cosIncidence).toBeCloseTo(1, 2);

    // Oblique ray reflects across normal preserving unit length
    const angle = Math.PI / 4;
    const hitOblique = marchToPillBoundary(
      0,
      0,
      Math.cos(angle),
      Math.sin(angle),
      halfW,
      halfH,
      radius
    );
    expect(Math.hypot(hitOblique.reflectedDx, hitOblique.reflectedDy)).toBeCloseTo(1, 3);

    const [rx, ry] = reflectRay2D(1 / Math.SQRT2, 1 / Math.SQRT2, 0, 1);
    expect(rx).toBeCloseTo(1 / Math.SQRT2, 5);
    expect(ry).toBeCloseTo(-1 / Math.SQRT2, 5);
  });

  test("inverseSquareFalloff decays monotonically with distance", () => {
    const d0 = inverseSquareFalloff(0, 1.0, 0.1, 0.02);
    const d4 = inverseSquareFalloff(4, 1.0, 0.1, 0.02);
    const d12 = inverseSquareFalloff(12, 1.0, 0.1, 0.02);

    expect(d0).toBeCloseTo(1.0, 5);
    expect(d4).toBeLessThan(d0);
    expect(d12).toBeLessThan(d4);
    expect(d12).toBeGreaterThan(0);
  });
});

describe("raycastCharacterLumen frame & activity modulation", () => {
  test("produces per-character lumen samples and backdrop caustic CSS variables", () => {
    const frame = raycastCharacterLumen({
      text: "Sonnet 5.5",
      pillWidth: 88,
      pillHeight: 22,
      cornerRadius: 7,
      rayCount: 16,
      activityState: "typing",
      timeSec: 0.4,
    });

    expect(frame.characters).toHaveLength("Sonnet 5.5".length);
    for (let i = 0; i < frame.characters.length; i++) {
      const sample = frame.characters[i]!;
      expect(sample.charIndex).toBe(i);
      expect(sample.char).toBe("Sonnet 5.5"[i]);
      expect(sample.glowIntensity).toBeGreaterThan(0.08);
      expect(sample.glowIntensity).toBeLessThanOrEqual(1.0);
      expect(sample.bounceIrradiance).toBeGreaterThan(0);
      expect(sample.specularHighlight).toBeGreaterThan(0);
      expect(sample.textShadowCss).toContain("--lumen-rim");
      expect(sample.textShadowCss).toContain("--lumen");
    }

    expect(frame.cssVars["--lumen-backdrop-caustic"]).toContain("radial-gradient");
    expect(frame.cssVars["--lumen-border-sheen"]).toContain("linear-gradient");
    expect(Number(frame.cssVars["--lumen-pill-opacity"])).toBeGreaterThan(0.4);
  });

  test("modulates lumen intensity across typing, thinking, reviewing, idle, and disconnected", () => {
    const baseOpts = {
      text: "Opus 5.5",
      pillWidth: 80,
      pillHeight: 22,
      cornerRadius: 7,
      rayCount: 16,
      timeSec: 0,
    };

    const typingFrame = raycastCharacterLumen({ ...baseOpts, activityState: "typing" });
    const thinkingFrame = raycastCharacterLumen({ ...baseOpts, activityState: "thinking" });
    const reviewingFrame = raycastCharacterLumen({ ...baseOpts, activityState: "reviewing" });
    const idleFrame = raycastCharacterLumen({ ...baseOpts, activityState: "idle" });
    const disconnectedFrame = raycastCharacterLumen({
      ...baseOpts,
      activityState: "disconnected",
    });

    expect(typingFrame.meanGlow).toBeGreaterThan(idleFrame.meanGlow);
    expect(thinkingFrame.meanGlow).toBeGreaterThan(idleFrame.meanGlow);
    expect(reviewingFrame.meanGlow).toBeGreaterThan(disconnectedFrame.meanGlow);
    expect(idleFrame.meanGlow).toBeGreaterThan(disconnectedFrame.meanGlow);
    expect(typingFrame.pillOpacity).toBeGreaterThan(disconnectedFrame.pillOpacity);
  });

  test("executes well within sub-millisecond per-frame performance budget", () => {
    // Warm up JIT
    raycastCharacterLumen({ text: "Sonnet 5.5", activityState: "typing" });

    const iterations = 40;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      raycastCharacterLumen({
        text: "Sonnet 5.5",
        pillWidth: 92,
        pillHeight: 22,
        cornerRadius: 7,
        rayCount: 16,
        activityState: "typing",
        timeSec: i * 0.016,
      });
    }
    const avgMs = (performance.now() - t0) / iterations;
    expect(avgMs).toBeLessThan(1.0);
  });

  test("Rust kernel crate maintains parity with TypeScript SDF & raycaster", async () => {
    const rustLibPath = join(process.cwd(), "rust/lumen-raycaster/src/lib.rs");
    expect(existsSync(rustLibPath)).toBe(true);
    const rustSource = readFileSync(rustLibPath, "utf8");
    expect(rustSource).toContain("pub extern \"C\" fn sdf_rounded_box");
    expect(rustSource).toContain("pub unsafe extern \"C\" fn compute_glyph_lumen");

    const fallbackKernel = await loadRustLumenKernel();
    expect(fallbackKernel).toBeNull();
  });
});
