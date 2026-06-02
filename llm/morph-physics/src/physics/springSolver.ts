/**
 * Damped spring integration (semi-implicit Euler). `deltaTime` is **milliseconds**;
 * internally converted to seconds for force integration.
 */
import type {
  PhysicsState,
  SpringConfig,
  SpringResult,
} from "../schemas/springSolverSchemas";
import type { Vector4 } from "../schemas/physicsSchemas";
import { morphPhysicsWarn } from "../debug";

export function solveSpring(
  current: number,
  target: number,
  velocity: number,
  config: SpringConfig,
  deltaTime: number
): PhysicsState {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(target) ||
    !Number.isFinite(velocity)
  ) {
    morphPhysicsWarn("solveSpring: Invalid input values", {
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
    morphPhysicsWarn("solveSpring: Invalid deltaTime", deltaTime);
    return {
      position: current,
      velocity: velocity,
    };
  }

  if (config.mass <= 0 || !Number.isFinite(config.mass)) {
    morphPhysicsWarn("solveSpring: Invalid mass", config.mass);
    return {
      position: current,
      velocity: velocity,
    };
  }

  const dt = deltaTime / 1000;

  const displacement = current - target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * velocity;

  const acceleration = (springForce + dampingForce) / config.mass;

  const newVelocity = velocity + acceleration * dt;
  const newPosition = current + newVelocity * dt;

  if (!Number.isFinite(newPosition) || !Number.isFinite(newVelocity)) {
    morphPhysicsWarn("solveSpring: Output became invalid", {
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
