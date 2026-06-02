import { RefObject, useCallback, useEffect, useRef } from "react";
import z from "zod";
import { FrameLoop } from "@/lib/morphTest/physics/frameLoop";
import {
  springConfigSchema,
  morphCurrentStateSchema,
  morphCurrentState,
} from "@/lib/morphTest/schemas/springSolverSchemas";
import {
  validateVector,
  applyMorphStateToElement,
  updateMorphState,
  prettyPrintPhysicsState,
  updateWebGLMesh,
} from "@/lib/morphTest/morphUtils";
import { vector4, Vector4 } from "@/lib/morphTest/schemas/physicsSchemas";
import { ZERO_VECTOR } from "@/lib/morphTest/constants";
import { morphPropertyRegistry } from "@/lib/morphTest/morphProperties";
import { Mesh } from "three";

export type { Vector4 };

// Schema for useMorphPhysics hook params
export const morphPhysicsParamsSchema = z.object({
  config: springConfigSchema.describe(
    "Spring physics configuration (stiffness, damping, mass, precision)"
  ),
  targetGeometry: vector4
    .optional()
    .describe("Optional target geometry for morph (x, y, w, h)"),
  webGLRef: z
    .custom<RefObject<Mesh | null>>()
    .optional()
    .describe("Optional ref to WebGL mesh for direct updates"),
});

// TODO: Make this a zod schema and fill in unknown
export type UseMorphPhysicsOutput = {
  elementRef: RefObject<HTMLDivElement | null>;
  reset: (vector: Vector4) => void;
  morphTo: (vector: Vector4) => void;
};

// Inferred TypeScript type for hook params
export type UseMorphPhysicsParams = z.infer<typeof morphPhysicsParamsSchema>;

/**
 * Checks if the physics simulation has settled (reached target with minimal velocity).
 * Checks all registered properties to determine if the entire morph state has settled.
 */
function isSettled(state: morphCurrentState, precision: number): boolean {
  const properties = morphPropertyRegistry.getAllProperties();

  for (const property of properties) {
    const current = property.getCurrentValue(state);
    const target = property.getTargetValue(state);

    if (current === undefined || target === undefined) {
      continue; // Skip properties that aren't set
    }

    // Use property's isSettled if available, otherwise default check
    if (property.isSettled) {
      if (!property.isSettled(state, precision)) {
        return false;
      }
    } else {
      // Default: if property has current and target, consider it not settled
      // This is a fallback for properties without custom isSettled
      return false;
    }
  }

  return true;
}

export function useMorphPhysics(
  params: UseMorphPhysicsParams
): UseMorphPhysicsOutput {
  // Ref to the DOM element that will be animated
  const elementRef = useRef<HTMLDivElement>(null);
  const prevState = useRef<morphCurrentState | null>(null);

  // Ref storing the morph state (current, target, velocity for all properties)
  // Uses a ref to persist across renders without triggering re-renders
  const morphStateRef = useRef<morphCurrentState>({
    velocity: ZERO_VECTOR,
    current: {},
    target: {},
  });

  // Ref to the frame loop instance that drives the animation
  const frameLoop = useRef<FrameLoop | null>(null);

  /**
   * Animation tick handler called each frame by the FrameLoop.
   * Advances the spring physics simulation by one step and applies the result to the DOM.
   */
  const onTick = useCallback(
    ({ deltaTime }: { deltaTime: number }) => {
      if (!elementRef.current) return;

      const state = morphStateRef.current;

      // Validate position state (required for backward compatibility)
      const positionProperty = morphPropertyRegistry.getProperty("position");
      if (!positionProperty) {
        // If position property is not registered, skip this frame
        return;
      }

      const current = positionProperty.getCurrentValue(state);
      const target = positionProperty.getTargetValue(state);

      if (!current || !target) {
        // If position is not set, skip this frame
        return;
      }

      // Type guard: ensure current and target are Vector4
      if (
        typeof current !== "object" ||
        !("x" in current) ||
        !("y" in current) ||
        !("w" in current) ||
        !("h" in current) ||
        typeof target !== "object" ||
        !("x" in target) ||
        !("y" in target) ||
        !("w" in target) ||
        !("h" in target)
      ) {
        return;
      }

      if (
        !validateVector(current as Vector4, "current position") ||
        !validateVector(target as Vector4, "target position") ||
        !validateVector(state.velocity, "velocity")
      ) {
        console.error("Physics state invalid, stopping animation");
        frameLoop.current?.stop();
        return;
      }

      // Update morph state using modular property system
      updateMorphState(state, params.config, deltaTime);

      // Keep track of latest state
      prevState.current = { ...state };

      // Apply current state to element using modular property system
      applyMorphStateToElement(elementRef.current, state);

      // Update the WebGL mesh if ref provided
      if (params.webGLRef?.current) {
        const currentPos = positionProperty.getCurrentValue(state);
        if (currentPos && typeof currentPos === "object" && "x" in currentPos) {
          const rect = currentPos as Vector4;
          const mesh = params.webGLRef.current;

          updateWebGLMesh(mesh, rect, state.velocity);
        }
      }

      // Debug: pretty print physics state (samples every 60 frames)
      const currentPos = positionProperty.getCurrentValue(state);
      if (currentPos && typeof currentPos === "object" && "x" in currentPos) {
        // Create a SpringResult for pretty printing (backward compatibility)
        const springResult = {
          position: currentPos as Vector4,
          velocity: state.velocity,
        };
        prettyPrintPhysicsState(state, springResult);
      }

      // Check if all properties have settled
      if (isSettled(state, params.config.precision)) {
        frameLoop.current?.stop();
      }
    },
    [params.config]
  );

  /**
   * Sets up and tears down the frame loop when the onTick callback changes.
   * Creates a new FrameLoop instance that will call onTick each frame,
   * and stops it on cleanup to prevent memory leaks.
   */
  useEffect(() => {
    frameLoop.current = new FrameLoop(onTick);
    return () => frameLoop.current?.stop();
  }, [onTick]);

  /**
   * Watches for changes to targetGeometry prop and updates the physics target.
   * When a new target is provided, it updates the physics state and starts the
   * animation loop to begin morphing towards the new target.
   */
  useEffect(() => {
    if (params.targetGeometry !== undefined) {
      const positionProperty = morphPropertyRegistry.getProperty("position");
      if (positionProperty) {
        positionProperty.setTargetValue(
          morphStateRef.current,
          params.targetGeometry
        );
      }

      frameLoop.current?.start();
    }
  }, [params.targetGeometry]);

  /**
   * Immediately resets the element to a specific position/geometry without animation.
   * Stops any ongoing animation, sets both current position and velocity to zero,
   * and applies the new geometry directly to the DOM element.
   */
  const reset = useCallback((vector: Vector4) => {
    frameLoop.current?.stop();
    // Validate input vector
    if (!validateVector(vector, "reset() input")) {
      console.error("reset() called with invalid vector:", vector);
      return;
    }

    const positionProperty = morphPropertyRegistry.getProperty("position");
    if (positionProperty) {
      positionProperty.setTargetValue(morphStateRef.current, vector);
      positionProperty.updateState(
        morphStateRef.current,
        { position: vector, velocity: ZERO_VECTOR },
        vector
      );
    }

    morphStateRef.current.velocity = ZERO_VECTOR;

    if (elementRef.current) {
      applyMorphStateToElement(elementRef.current, morphStateRef.current);
      console.log(
        "reset() - Physics current:",
        positionProperty?.getCurrentValue(morphStateRef.current)
      );
      console.log("reset() - Applied styles:", {
        transform: elementRef.current.style.transform,
        width: elementRef.current.style.width,
        height: elementRef.current.style.height,
      });
    }
  }, []);

  /**
   * Initiates an animated morph to a new target geometry.
   * Updates the physics target and starts the animation loop, which will
   * smoothly animate the element from its current state to the new target
   * using spring physics.
   */
  const morphTo = useCallback((target: Vector4) => {
    // Validate input vector
    if (!validateVector(target, "morphTo() target")) {
      console.error("morphTo() called with invalid target:", target);
      return;
    }

    const positionProperty = morphPropertyRegistry.getProperty("position");
    if (positionProperty) {
      positionProperty.setTargetValue(morphStateRef.current, target);
    }

    console.log("morphTo() - Target:", target);
    console.log(
      "morphTo() - Physics current:",
      positionProperty?.getCurrentValue(morphStateRef.current)
    );
    if (frameLoop.current) {
      frameLoop.current.start();
    }
  }, []);

  return { elementRef, reset, morphTo };
}
