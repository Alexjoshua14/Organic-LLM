import { Vector4 } from "@/lib/morphTest/schemas/physicsSchemas";
import {
  morphCurrentState,
  PhysicsStateVector4,
  SpringResult,
  SpringConfig,
} from "./schemas/springSolverSchemas";
import { morphPropertyRegistry } from "./morphProperties";
import { Mesh } from "three";
import * as THREE from "three";

/**
 * Captures the current geometry (position and size) of an element as a Vector4.
 *
 * If a container is provided, returns position relative to the container.
 * Otherwise, returns position relative to the viewport.
 *
 * @param element - The element to snapshot
 * @param container - Optional container element for relative positioning
 * @returns Vector4 with x, y (position) and w, h (size)
 */
export function snapshot(
  element: HTMLElement,
  container?: HTMLElement
): Vector4 {
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

  const vec: Vector4 = {
    x: elementRect.x,
    y: elementRect.y,
    w: elementRect.width,
    h: elementRect.height,
  };

  return vec;
}

/**
 * Validates that all components of a Vector4 are finite numbers.
 * Logs an error and returns false if any component is NaN or Infinity.
 *
 * @param v - The vector to validate
 * @param name - Name/context for error messages
 * @returns true if all components are finite, false otherwise
 */
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

// ============================================================================
// Vector Arithmetic Operations
// ============================================================================

/**
 * Subtracts vector b from vector a (a - b)
 */
export function subtract(a: Vector4, b: Vector4): Vector4 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    w: a.w - b.w,
    h: a.h - b.h,
  };
}

/**
 * Adds two vectors (a + b)
 */
export function add(a: Vector4, b: Vector4): Vector4 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    w: a.w + b.w,
    h: a.h + b.h,
  };
}

/**
 * Multiplies a vector by a scalar
 */
export function multiply(v: Vector4, scalar: number): Vector4 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    w: v.w * scalar,
    h: v.h * scalar,
  };
}

/**
 * Returns the absolute value of each component
 */
export function abs(v: Vector4): Vector4 {
  return {
    x: Math.abs(v.x),
    y: Math.abs(v.y),
    w: Math.abs(v.w),
    h: Math.abs(v.h),
  };
}

/**
 * Returns the sum of absolute values of all components (L1 norm / Manhattan distance)
 */
export function magnitude(v: Vector4): number {
  return Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.w) + Math.abs(v.h);
}

/**
 * Clears inline transform and size styles from an element to get its natural layout.
 * This is useful before taking a snapshot to measure the element's default dimensions.
 */
export function clearInlineStyles(element: HTMLElement): void {
  element.style.transform = "";
  element.style.width = "";
  element.style.height = "";
}

/**
 * Applies a Vector4 to an element's DOM styles.
 * Uses translate(x, y) for position and sets width/height with px units.
 * @deprecated Use applyMorphStateToElement instead for modular property application
 */
export function applyVectorTransformToElement(
  element: HTMLElement,
  vector: Vector4
): void {
  element.style.transform = `translate(${vector.x}px, ${vector.y}px)`;
  element.style.width = `${vector.w}px`;
  element.style.height = `${vector.h}px`;
}

/**
 * Applies morph state to a DOM element.
 * Iterates through registered properties and applies each one that has a current value.
 */
export function applyMorphStateToElement(
  element: HTMLElement,
  state: morphCurrentState
): void {
  const properties = morphPropertyRegistry.getAllProperties();

  for (const property of properties) {
    const current = property.getCurrentValue(state);
    if (current !== undefined) {
      property.applyToElement(element, current);
    }
  }
}

/**
 * Updates physics state with spring result.
 * Mutates the state object directly by updating current position and velocity.
 * @deprecated Use updateMorphState instead for modular property updates
 */
export function updatePhysicsState(
  state: PhysicsStateVector4,
  springResult: SpringResult
): void {
  state.current = springResult.position;
  state.velocity = springResult.velocity;
}

/**
 * Updates morph state with spring physics results for all registered properties.
 * Iterates through registered properties and updates each one.
 *
 * Note: Currently velocity is only stored for position (in state.velocity as Vector4).
 * Other properties will need velocity storage added to the schema in the future.
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
      continue; // Skip properties that aren't set
    }

    // Get velocity for this property
    // For position, use state.velocity (Vector4)
    // For other properties, we'd need to extend the schema or store separately
    // For now, position uses state.velocity, others use zero velocity
    let velocity: unknown;
    if (property.key === "position") {
      velocity = state.velocity;
    } else {
      // For non-position properties, we need zero velocity
      // This is a limitation - we'll need to extend the schema to store velocities per property
      // For now, create a zero velocity based on the property type
      if (property.key === "color") {
        velocity = { h: 0, s: 0, l: 0, a: 0 };
      } else if (property.key === "brightness") {
        velocity = 0;
      } else {
        // Default: try to create zero value from schema
        // This is a workaround until we properly extend the schema
        continue; // Skip properties without velocity support for now
      }
    }

    // Solve spring physics for this property
    if (property.solveSpring) {
      const result = property.solveSpring(
        current,
        target,
        velocity,
        config,
        deltaTime
      );

      // Create a dummy SpringResult for updateState (it may not use it)
      const dummySpringResult: SpringResult = {
        position: { x: 0, y: 0, w: 0, h: 0 },
        velocity: { x: 0, y: 0, w: 0, h: 0 },
      };

      // Update state with new value
      property.updateState(state, dummySpringResult, result.value);

      // Update velocity for position (stored in top-level)
      if (property.key === "position" && result.velocity) {
        state.velocity = result.velocity as Vector4;
      }
      // TODO: Store velocity for other properties when schema is extended
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

  // DOM to WebGL coordinate conversion
  const x = rect.x + rect.w / 2 - width / 2;
  const y = -(rect.y + rect.h / 2 - height / 2);

  mesh.position.set(x, y, 0);

  // TODO: Determine if scale needs to be updated
  // const scaleX = ..
  // const scaleY = ..
  // mesh.scale.set()

  // Update shader uniforms
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

// Counter to track how many times prettyPrintPhysicsState has been called
let physicsStatePrintCount = 0;

/**
 * Pretty prints physics state fields for debugging.
 * Extracts and formats specified fields from the physics state and spring result.
 * Pass the full objects and extract fields inside this function as needed.
 * Samples states every 60 frames (~2 times per second at 60fps).
 */
export function prettyPrintPhysicsState(
  state: morphCurrentState,
  springResult: SpringResult
): void {
  physicsStatePrintCount++;

  // Only print every 60 frames (~2 times per second at 60fps)
  if (physicsStatePrintCount % 60 !== 0) {
    return;
  }

  const output: Record<string, unknown> = {};

  // Extract fields from springResult
  output.width = springResult.position.w;
  output.height = springResult.position.h;
  // Add more springResult fields here as needed

  // Extract fields from state
  output.targetWidth = state.target.position?.w;
  output.targetHeight = state.target.position?.h;
  // Add more state fields here as needed

  console.log("Physics State:", output);
}
