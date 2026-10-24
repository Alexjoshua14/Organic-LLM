/**
 * DOM layout measurement, Vector4 math, morph state integration, optional Three mesh sync.
 * Depends on `morphPropertyRegistry` (register defaults via `import "@organic-llm/morph-physics"` or `./morphProperties`).
 */
import type { Vector4 } from "./schemas/physicsSchemas";
import type {
  morphCurrentState,
  PhysicsStateVector4,
  SpringResult,
  SpringConfig,
} from "./schemas/springSolverSchemas";
import type { Mesh } from "three";

import * as THREE from "three";

import { morphPropertyRegistry } from "./morphProperties/registry";
import { morphPhysicsLog } from "./debug";

export function snapshot(element: HTMLElement, container?: HTMLElement): Vector4 {
  const elementRect = element.getBoundingClientRect();

  if (container) {
    const containerRect = container.getBoundingClientRect();

    return {
      x: elementRect.x - containerRect.x,
      y: elementRect.y - containerRect.y,
      w: elementRect.width,
      h: elementRect.height,
    };
  }

  return {
    x: elementRect.x,
    y: elementRect.y,
    w: elementRect.width,
    h: elementRect.height,
  };
}

export const validateVector = (v: Vector4, name: string) => {
  if (
    !Number.isFinite(v.x) ||
    !Number.isFinite(v.y) ||
    !Number.isFinite(v.w) ||
    !Number.isFinite(v.h)
  ) {
    console.error(`Invalid vector, ${name}:`, v);

    return false;
  }

  return true;
};

export function subtract(a: Vector4, b: Vector4): Vector4 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    w: a.w - b.w,
    h: a.h - b.h,
  };
}

export function add(a: Vector4, b: Vector4): Vector4 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    w: a.w + b.w,
    h: a.h + b.h,
  };
}

export function multiply(v: Vector4, scalar: number): Vector4 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    w: v.w * scalar,
    h: v.h * scalar,
  };
}

export function abs(v: Vector4): Vector4 {
  return {
    x: Math.abs(v.x),
    y: Math.abs(v.y),
    w: Math.abs(v.w),
    h: Math.abs(v.h),
  };
}

export function magnitude(v: Vector4): number {
  return Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.w) + Math.abs(v.h);
}

export function clearInlineStyles(element: HTMLElement): void {
  element.style.transform = "";
  element.style.width = "";
  element.style.height = "";
}

/** @deprecated Prefer `applyMorphStateToElement` via the property registry. */
export function applyVectorTransformToElement(element: HTMLElement, vector: Vector4): void {
  element.style.transform = `translate(${vector.x}px, ${vector.y}px)`;
  element.style.width = `${vector.w}px`;
  element.style.height = `${vector.h}px`;
}

export function applyMorphStateToElement(element: HTMLElement, state: morphCurrentState): void {
  const properties = morphPropertyRegistry.getAllProperties();

  for (const property of properties) {
    const current = property.getCurrentValue(state);

    if (current !== undefined) {
      property.applyToElement(element, current);
    }
  }
}

/** @deprecated Prefer `updateMorphState`. */
export function updatePhysicsState(state: PhysicsStateVector4, springResult: SpringResult): void {
  state.current = springResult.position;
  state.velocity = springResult.velocity;
}

/**
 * One integration step: each registered property with current+target runs its `solveSpring`,
 * then `updateState`. Position velocity lives on `state.velocity`; other properties use
 * provisional zero velocity until the schema is extended (see Nebulae morph-lab notes).
 */
export function updateMorphState(
  state: morphCurrentState,
  config: SpringConfig,
  deltaTime: number
): void {
  const properties = morphPropertyRegistry.getAllProperties();

  for (const property of properties) {
    const current = property.getCurrentValue(state);
    const target = property.getTargetValue(state);

    if (current === undefined || target === undefined) {
      continue;
    }

    let velocity: unknown;

    if (property.key === "position") {
      velocity = state.velocity;
    } else {
      if (property.key === "color") {
        velocity = { h: 0, s: 0, l: 0, a: 0 };
      } else if (property.key === "brightness") {
        velocity = 0;
      } else {
        continue;
      }
    }

    if (property.solveSpring) {
      const result = property.solveSpring(current, target, velocity, config, deltaTime);

      const dummySpringResult: SpringResult = {
        position: { x: 0, y: 0, w: 0, h: 0 },
        velocity: { x: 0, y: 0, w: 0, h: 0 },
      };

      property.updateState(state, dummySpringResult, result.value);

      if (property.key === "position" && result.velocity) {
        state.velocity = result.velocity as Vector4;
      }
    }
  }
}

export function updateWebGLMesh(
  mesh: Mesh,
  rect: Vector4,
  velocity: Vector4,
  canvasSize?: { width: number; height: number }
): void {
  const width = canvasSize?.width ?? window.innerWidth;
  const height = canvasSize?.height ?? window.innerHeight;

  const x = rect.x + rect.w / 2 - width / 2;
  const y = -(rect.y + rect.h / 2 - height / 2);

  mesh.position.set(x, y, 0);

  if (mesh.material && "uniforms" in mesh.material) {
    const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;

    if (uniforms.uDimensions) {
      uniforms.uDimensions.value = [rect.w, rect.h];
    }
    if (uniforms.uVelocity) {
      uniforms.uVelocity.value = [velocity.x, velocity.y];
    }
  }
}

let physicsStatePrintCount = 0;

/** Sampled debug logging (~every 60 ticks); no-op in production builds. */
export function prettyPrintPhysicsState(
  state: morphCurrentState,
  springResult: SpringResult
): void {
  physicsStatePrintCount++;

  if (physicsStatePrintCount % 60 !== 0) {
    return;
  }

  const output: Record<string, unknown> = {
    width: springResult.position.w,
    height: springResult.position.h,
    targetWidth: state.target.position?.w,
    targetHeight: state.target.position?.h,
  };

  morphPhysicsLog("Physics State:", output);
}
