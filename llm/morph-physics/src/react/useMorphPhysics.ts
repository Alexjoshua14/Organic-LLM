import { type RefObject, useCallback, useEffect, useRef } from "react";
import z from "zod";
import { FrameLoop } from "../physics/frameLoop";
import { springConfigSchema, type morphCurrentState } from "../schemas/springSolverSchemas";
import {
  validateVector,
  applyMorphStateToElement,
  updateMorphState,
  prettyPrintPhysicsState,
  updateWebGLMesh,
} from "../morphUtils";
import { vector4, type Vector4 } from "../schemas/physicsSchemas";
import { ZERO_VECTOR } from "../constants";
import { morphPropertyRegistry } from "../morphProperties/index";
import type { Mesh } from "three";
import { morphPhysicsLog } from "../debug";

export type { Vector4 };

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

export type UseMorphPhysicsOutput = {
  elementRef: RefObject<HTMLDivElement | null>;
  reset: (vector: Vector4) => void;
  morphTo: (vector: Vector4) => void;
};

export type UseMorphPhysicsParams = z.infer<typeof morphPhysicsParamsSchema>;

function isSettled(state: morphCurrentState, precision: number): boolean {
  const properties = morphPropertyRegistry.getAllProperties();

  for (const property of properties) {
    const current = property.getCurrentValue(state);
    const target = property.getTargetValue(state);

    if (current === undefined || target === undefined) {
      continue;
    }

    if (property.isSettled) {
      if (!property.isSettled(state, precision)) {
        return false;
      }
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Drives spring morph on `elementRef`: each frame integrates registered properties,
 * applies DOM styles, optionally syncs a Three.js mesh, stops when `isSettled`.
 */
export function useMorphPhysics(
  params: UseMorphPhysicsParams
): UseMorphPhysicsOutput {
  const elementRef = useRef<HTMLDivElement>(null);
  const prevState = useRef<morphCurrentState | null>(null);

  const morphStateRef = useRef<morphCurrentState>({
    velocity: ZERO_VECTOR,
    current: {},
    target: {},
  });

  const frameLoop = useRef<FrameLoop | null>(null);

  const onTick = useCallback(
    ({ deltaTime }: { deltaTime: number }) => {
      if (!elementRef.current) return;

      const state = morphStateRef.current;

      const positionProperty = morphPropertyRegistry.getProperty("position");
      if (!positionProperty) {
        return;
      }

      const current = positionProperty.getCurrentValue(state);
      const target = positionProperty.getTargetValue(state);

      if (!current || !target) {
        return;
      }

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

      updateMorphState(state, params.config, deltaTime);

      prevState.current = { ...state };

      applyMorphStateToElement(elementRef.current, state);

      if (params.webGLRef?.current) {
        const currentPos = positionProperty.getCurrentValue(state);
        if (currentPos && typeof currentPos === "object" && "x" in currentPos) {
          const rect = currentPos as Vector4;
          const mesh = params.webGLRef.current;

          updateWebGLMesh(mesh, rect, state.velocity);
        }
      }

      const currentPos = positionProperty.getCurrentValue(state);
      if (currentPos && typeof currentPos === "object" && "x" in currentPos) {
        const springResult = {
          position: currentPos as Vector4,
          velocity: state.velocity,
        };
        prettyPrintPhysicsState(state, springResult);
      }

      if (isSettled(state, params.config.precision)) {
        frameLoop.current?.stop();
      }
    },
    [params.config]
  );

  useEffect(() => {
    frameLoop.current = new FrameLoop(onTick);
    return () => frameLoop.current?.stop();
  }, [onTick]);

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

  const reset = useCallback((vector: Vector4) => {
    frameLoop.current?.stop();
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
      morphPhysicsLog(
        "reset() - Physics current:",
        positionProperty?.getCurrentValue(morphStateRef.current)
      );
      morphPhysicsLog("reset() - Applied styles:", {
        transform: elementRef.current.style.transform,
        width: elementRef.current.style.width,
        height: elementRef.current.style.height,
      });
    }
  }, []);

  const morphTo = useCallback((target: Vector4) => {
    if (!validateVector(target, "morphTo() target")) {
      console.error("morphTo() called with invalid target:", target);
      return;
    }

    const positionProperty = morphPropertyRegistry.getProperty("position");
    if (positionProperty) {
      positionProperty.setTargetValue(morphStateRef.current, target);
    }

    morphPhysicsLog("morphTo() - Target:", target);
    morphPhysicsLog(
      "morphTo() - Physics current:",
      positionProperty?.getCurrentValue(morphStateRef.current)
    );
    if (frameLoop.current) {
      frameLoop.current.start();
    }
  }, []);

  return { elementRef, reset, morphTo };
}
