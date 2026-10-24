import type { SpringConfig } from "@organic-llm/morph-physics";
import type { ActivityGlassAppearance } from "./activity-mark-glass";

import { solveSpring } from "@organic-llm/morph-physics";

import { ACTIVITY_GLASS_MAX_BLUR } from "./activity-mark-glass";

export type GlassPose = Pick<ActivityGlassAppearance, "blur" | "opacity" | "brightness">;

// Critically damped: most of the change happens in ~250ms, with a quiet settling tail.
const SPRING: SpringConfig = { stiffness: 400, damping: 40, mass: 1, precision: 0.001 };
const MAX_STEP_MS = 1000 / 120;
const MAX_DELTA_MS = 50;
const BOUNDS = { blur: [0, ACTIVITY_GLASS_MAX_BLUR], opacity: [0, 1], brightness: [0, 2] } as const;
const KEYS = ["blur", "opacity", "brightness"] as const;
const zeroVelocity = (): GlassPose => ({ blur: 0, opacity: 0, brightness: 0 });

function bounded(pose: GlassPose): GlassPose {
  const result: GlassPose = { blur: pose.blur, opacity: pose.opacity, brightness: pose.brightness };

  for (const key of KEYS) {
    if (!Number.isFinite(pose[key])) throw new Error("Invalid glass target");
    const [min, max] = BOUNDS[key];

    result[key] = Math.max(min, Math.min(max, pose[key]));
  }

  return result;
}

/** A material-only morph-physics instance; retargeting preserves all three velocities. */
export class GlassMorphPhysics {
  current: GlassPose;
  settled = true;
  private target: GlassPose;
  private velocity = zeroVelocity();

  constructor(initial: GlassPose) {
    this.current = bounded(initial);
    this.target = { ...this.current };
  }

  morphTo(target: GlassPose) {
    this.target = bounded(target);
    this.settled = KEYS.every(
      (key) => this.current[key] === this.target[key] && this.velocity[key] === 0
    );
  }

  snap(): GlassPose {
    this.current = { ...this.target };
    this.velocity = zeroVelocity();
    this.settled = true;

    return this.current;
  }

  step(deltaTime: number): GlassPose {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) throw new Error("Invalid glass frame");
    if (this.settled) return this.current;
    const elapsed = Math.min(deltaTime, MAX_DELTA_MS);
    const steps = Math.ceil(elapsed / MAX_STEP_MS);

    for (let step = 0; step < steps; step++) {
      for (const key of KEYS) {
        const result = solveSpring(
          this.current[key],
          this.target[key],
          this.velocity[key],
          SPRING,
          elapsed / steps
        );

        if (!Number.isFinite(result.position) || !Number.isFinite(result.velocity)) {
          throw new Error("Invalid glass physics result");
        }
        const [min, max] = BOUNDS[key];

        this.current[key] = Math.max(min, Math.min(max, result.position));
        this.velocity[key] = this.current[key] === result.position ? result.velocity : 0;
      }
    }

    if (
      KEYS.every(
        (key) =>
          Math.abs(this.current[key] - this.target[key]) < SPRING.precision &&
          Math.abs(this.velocity[key]) < SPRING.precision * 10
      )
    ) {
      this.snap();
    }

    return this.current;
  }
}
