import {
  SolveParams,
  OutputParams,
  PhysicsState,
  SpringConfig,
  SpringResult,
  solveParamsSchema,
  outputParamsSchema,
  physicsStateSchema,
  springConfigSchema,
} from "../schemas/springSolverSchemas";
import { Vector4 } from "../schemas/physicsSchemas";

/**
 * *******************************
 * Contemplate removing this first section
 * Although perhaps keep it, offload the pure part of the solver logic
 * And then this can easily be multithreaded
 * It's probably not more efficent (although possibly) but consider breaking into multithreads for solving
 * i.e., perform concompetiting calculations simultaenuosly
 */
export type {
  SolveParams,
  OutputParams,
  PhysicsState,
  SpringConfig,
  SpringResult,
};

// Re-export schemas for convenience
export { springConfigSchema, physicsStateSchema };

/**
 * Pure Semi-Implict Euler Integration
 * Returns the next state based on current state + dt
 * @param params - Object containing spring settings and state.
 * @returns The updated state after applying the solver.
 */
export function solveSpring(
  current: number,
  target: number,
  velocity: number,
  config: SpringConfig,
  deltaTime: number
): PhysicsState {
  // Validate inputs to prevent NaN/Infinity
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(target) ||
    !Number.isFinite(velocity)
  ) {
    console.warn("solveSpring: Invalid input values", {
      current,
      target,
      velocity,
    });
    return {
      position: Number.isFinite(current) ? current : target,
      velocity: Number.isFinite(velocity) ? velocity : 0,
    };
  }

  if (!Number.isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1000) {
    console.warn("solveSpring: Invalid deltaTime", deltaTime);
    return {
      position: current,
      velocity: velocity,
    };
  }

  if (config.mass <= 0 || !Number.isFinite(config.mass)) {
    console.warn("solveSpring: Invalid mass", config.mass);
    return {
      position: current,
      velocity: velocity,
    };
  }

  // Convert deltaTime from milliseconds to seconds for physics calculations
  const dt = deltaTime / 1000;

  const displacement = current - target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * velocity;

  const acceleration = (springForce + dampingForce) / config.mass;

  const newVelocity = velocity + acceleration * dt;
  const newPosition = current + newVelocity * dt;

  // Validate outputs to prevent NaN/Infinity
  if (!Number.isFinite(newPosition) || !Number.isFinite(newVelocity)) {
    console.warn("solveSpring: Output became invalid", {
      newPosition,
      newVelocity,
      current,
      target,
      velocity,
      dt,
    });
    return {
      position: current,
      velocity: 0,
    };
  }

  return {
    position: newPosition,
    velocity: newVelocity,
  };
}

/**
 * Solves spring physics for all Vector4 components.
 * Returns both the new position and velocity as Vector4s.
 */
export function solveSpringVector4(
  current: Vector4,
  target: Vector4,
  velocity: Vector4,
  config: SpringConfig,
  deltaTime: number
): SpringResult {
  const x = solveSpring(current.x, target.x, velocity.x, config, deltaTime);
  const y = solveSpring(current.y, target.y, velocity.y, config, deltaTime);
  const w = solveSpring(current.w, target.w, velocity.w, config, deltaTime);
  const h = solveSpring(current.h, target.h, velocity.h, config, deltaTime);

  return {
    position: {
      x: x.position,
      y: y.position,
      w: w.position,
      h: h.position,
    },
    velocity: {
      x: x.velocity,
      y: y.velocity,
      w: w.velocity,
      h: h.velocity,
    },
  };
}
