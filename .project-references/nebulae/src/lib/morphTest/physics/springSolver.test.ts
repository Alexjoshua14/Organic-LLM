import { describe, it, expect } from "vitest";
import { solveSpring, solveSpringVector4 } from "./springSolver";
import { SpringConfig } from "../schemas/springSolverSchemas";
import { ZERO_VECTOR } from "../constants";
import { magnitude } from "../morphUtils";

describe("solveSpring", () => {
  const config: SpringConfig = {
    stiffness: 170,
    damping: 26,
    mass: 1,
    precision: 0.01,
  };

  it("should move towards target when current is different from target", () => {
    const result = solveSpring(0, 100, 0, config, 16); // 16ms deltaTime

    // Should move towards target
    expect(result.position).toBeGreaterThan(0);
    expect(result.position).toBeLessThan(100);
    // Should have positive velocity
    expect(result.velocity).toBeGreaterThan(0);
  });

  it("should converge towards target over multiple steps", () => {
    let current = 0;
    let velocity = 0;
    const target = 100;
    const deltaTime = 16; // ~60fps

    // Simulate multiple frames
    for (let i = 0; i < 100; i++) {
      const result = solveSpring(current, target, velocity, config, deltaTime);
      current = result.position;
      velocity = result.velocity;
    }

    // Should be close to target after many iterations
    expect(current).toBeCloseTo(target, 1);
    expect(Math.abs(velocity)).toBeLessThan(1); // Should be settling
  });

  it("should handle zero velocity at target", () => {
    const result = solveSpring(100, 100, 0, config, 16);

    // At target with zero velocity, should stay at target
    expect(result.position).toBe(100);
    expect(result.velocity).toBe(0);
  });

  it("should dampen velocity over time", () => {
    let current = 0;
    let velocity = 100; // High initial velocity
    const target = 0;
    const deltaTime = 16;

    const result = solveSpring(current, target, velocity, config, deltaTime);

    // Velocity should be reduced due to damping
    expect(Math.abs(result.velocity)).toBeLessThan(Math.abs(velocity));
  });

  it("should handle negative values", () => {
    const result = solveSpring(-50, -100, 0, config, 16);

    // Should move towards more negative target
    expect(result.position).toBeLessThan(-50);
    expect(result.position).toBeGreaterThan(-100);
  });

  it("should return current position when deltaTime is invalid", () => {
    const result = solveSpring(50, 100, 10, config, -10);

    expect(result.position).toBe(50);
    expect(result.velocity).toBe(10);
  });

  it("should return current position when deltaTime is too large", () => {
    const result = solveSpring(50, 100, 10, config, 2000);

    expect(result.position).toBe(50);
    expect(result.velocity).toBe(10);
  });

  it("should handle invalid mass", () => {
    const invalidConfig: SpringConfig = {
      ...config,
      mass: 0,
    };

    const result = solveSpring(50, 100, 10, invalidConfig, 16);

    expect(result.position).toBe(50);
    expect(result.velocity).toBe(10);
  });

  it("should handle NaN inputs", () => {
    const result = solveSpring(NaN, 100, 0, config, 16);

    // Should return target as fallback
    expect(result.position).toBe(100);
    expect(result.velocity).toBe(0);
  });

  it("should handle Infinity inputs", () => {
    const result = solveSpring(Infinity, 100, 0, config, 16);

    // Should return target as fallback
    expect(result.position).toBe(100);
    expect(result.velocity).toBe(0);
  });

  it("should produce finite outputs", () => {
    const result = solveSpring(0, 100, 0, config, 16);

    expect(Number.isFinite(result.position)).toBe(true);
    expect(Number.isFinite(result.velocity)).toBe(true);
  });
});

describe("solveSpringVector4", () => {
  const config: SpringConfig = {
    stiffness: 170,
    damping: 26,
    mass: 1,
    precision: 0.01,
  };

  it("should solve all components independently", () => {
    const current = { x: 0, y: 0, w: 100, h: 100 };
    const target = { x: 100, y: 50, w: 200, h: 150 };
    const velocity = ZERO_VECTOR;
    const deltaTime = 16;

    const result = solveSpringVector4(
      current,
      target,
      velocity,
      config,
      deltaTime
    );

    // All components should move towards their targets
    expect(result.position.x).toBeGreaterThan(0);
    expect(result.position.y).toBeGreaterThan(0);
    expect(result.position.w).toBeGreaterThan(100);
    expect(result.position.h).toBeGreaterThan(100);

    // All velocities should be positive (moving towards targets)
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.velocity.y).toBeGreaterThan(0);
    expect(result.velocity.w).toBeGreaterThan(0);
    expect(result.velocity.h).toBeGreaterThan(0);
  });

  it("should return zero velocity when at target", () => {
    const current = { x: 100, y: 50, w: 200, h: 150 };
    const target = { x: 100, y: 50, w: 200, h: 150 };
    const velocity = ZERO_VECTOR;
    const deltaTime = 16;

    const result = solveSpringVector4(
      current,
      target,
      velocity,
      config,
      deltaTime
    );

    expect(result.position).toEqual(target);
    expect(result.velocity).toEqual(ZERO_VECTOR);
  });

  it("should handle negative values in all components", () => {
    const current = { x: -50, y: -30, w: -100, h: -80 };
    const target = { x: -100, y: -50, w: -200, h: -150 };
    const velocity = ZERO_VECTOR;
    const deltaTime = 16;

    const result = solveSpringVector4(
      current,
      target,
      velocity,
      config,
      deltaTime
    );

    // All components should move towards more negative targets
    expect(result.position.x).toBeLessThan(-50);
    expect(result.position.y).toBeLessThan(-30);
    expect(result.position.w).toBeLessThan(-100);
    expect(result.position.h).toBeLessThan(-80);
  });

  it("should converge all components over multiple steps", () => {
    let current = { x: 0, y: 0, w: 100, h: 100 };
    let velocity = ZERO_VECTOR;
    const target = { x: 100, y: 50, w: 200, h: 150 };
    const deltaTime = 16;

    // Simulate multiple frames
    for (let i = 0; i < 200; i++) {
      const result = solveSpringVector4(
        current,
        target,
        velocity,
        config,
        deltaTime
      );
      current = result.position;
      velocity = result.velocity;
    }

    // All components should be close to targets
    expect(current.x).toBeCloseTo(target.x, 1);
    expect(current.y).toBeCloseTo(target.y, 1);
    expect(current.w).toBeCloseTo(target.w, 1);
    expect(current.h).toBeCloseTo(target.h, 1);

    // Velocities should be small (settling)
    expect(magnitude(velocity)).toBeLessThan(1);
  });

  it("should produce finite outputs for all components", () => {
    const current = { x: 0, y: 0, w: 100, h: 100 };
    const target = { x: 100, y: 50, w: 200, h: 150 };
    const velocity = ZERO_VECTOR;
    const deltaTime = 16;

    const result = solveSpringVector4(
      current,
      target,
      velocity,
      config,
      deltaTime
    );

    expect(Number.isFinite(result.position.x)).toBe(true);
    expect(Number.isFinite(result.position.y)).toBe(true);
    expect(Number.isFinite(result.position.w)).toBe(true);
    expect(Number.isFinite(result.position.h)).toBe(true);
    expect(Number.isFinite(result.velocity.x)).toBe(true);
    expect(Number.isFinite(result.velocity.y)).toBe(true);
    expect(Number.isFinite(result.velocity.w)).toBe(true);
    expect(Number.isFinite(result.velocity.h)).toBe(true);
  });
});
