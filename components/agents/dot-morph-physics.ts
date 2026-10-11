import type { SpringConfig } from "@organic-llm/morph-physics";
import type { AgentDotState } from "./agent-dot-grid-motion";

import { solveSpring } from "@organic-llm/morph-physics";

import { AGENT_DOTS, WAITING_VARIANCE } from "./agent-dot-grid-motion";

export type DotPose = { x: number; y: number; scale: number };

const SPRINGS: Record<AgentDotState, SpringConfig> = {
  idle: { stiffness: 12, damping: 8, mass: 1, precision: 0.001 },
  working: { stiffness: 30, damping: 10, mass: 1, precision: 0.001 },
  waiting: { stiffness: 12, damping: 8, mass: 1, precision: 0.001 },
  blocked: { stiffness: 30, damping: 10, mass: 1, precision: 0.001 },
  complete: { stiffness: 170, damping: 26, mass: 1, precision: 0.001 },
};
const MAX_STEP_MS = 1000 / 120;
const MAX_DELTA_MS = 50;
const COMPLETE_PULSE_MS = 160;
const COMPLETE_STAGGER_MS = 20;
const WAITING_PERIOD_MS = 5000;
const BLOCKED_PERIOD_MS = 3600;
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.35;
const MAX_OFFSET = 0.5;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** One independent morph-physics instance per dot, with persistent position and velocity. */
export class DotMorphPhysics {
  current: DotPose;
  private velocity: DotPose = { x: 0, y: 0, scale: 0 };
  private target: DotPose;
  private state: AgentDotState = "idle";
  private age = 0;
  private nextTargetAt = 0;
  private phase = -1;
  complete = false;

  constructor(
    private restScale: number,
    private index: number,
    private random = Math.random
  ) {
    this.current = { x: 0, y: 0, scale: restScale };
    this.target = { ...this.current };
  }

  setState(state: AgentDotState) {
    if (this.state === state) return;

    this.state = state;
    this.age = 0;
    this.phase = -1;
    this.nextTargetAt = 0;
    this.complete = false;
  }

  morphTo(target: DotPose) {
    if (!Object.values(target).every(Number.isFinite)) throw new Error("Invalid dot target");

    this.target = {
      x: clamp(target.x, -MAX_OFFSET, MAX_OFFSET),
      y: clamp(target.y, -MAX_OFFSET, MAX_OFFSET),
      scale: clamp(target.scale, MIN_SCALE, MAX_SCALE),
    };
  }

  step(deltaTime: number): DotPose {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) throw new Error("Invalid dot frame");

    const elapsed = Math.min(deltaTime, MAX_DELTA_MS);

    if (this.complete) return this.current;
    this.age += elapsed;
    this.updateTarget();
    const steps = Math.ceil(elapsed / MAX_STEP_MS);
    const dt = elapsed / steps;
    const config = SPRINGS[this.state];

    for (let step = 0; step < steps; step++) {
      for (const key of ["x", "y", "scale"] as const) {
        const result = solveSpring(
          this.current[key],
          this.target[key],
          this.velocity[key],
          config,
          dt
        );

        if (!Number.isFinite(result.position) || !Number.isFinite(result.velocity)) {
          throw new Error("Invalid dot physics result");
        }
        const min = key === "scale" ? MIN_SCALE : -MAX_OFFSET;
        const max = key === "scale" ? MAX_SCALE : MAX_OFFSET;

        this.current[key] = clamp(result.position, min, max);
        this.velocity[key] = result.position === this.current[key] ? result.velocity : 0;
      }
    }

    if (
      this.state === "complete" &&
      this.phase === 2 &&
      (Object.keys(this.current) as Array<keyof DotPose>).every(
        (key) =>
          Math.abs(this.current[key] - this.target[key]) < config.precision &&
          Math.abs(this.velocity[key]) < config.precision * 10
      )
    ) {
      this.current = { ...this.target };
      this.velocity = { x: 0, y: 0, scale: 0 };
      this.complete = true;
    }

    return this.current;
  }

  private updateTarget() {
    if (this.state === "idle" || this.state === "working") {
      if (this.age < this.nextTargetAt) return;
      const working = this.state === "working";
      const variance = (working ? 0.2 : 0.05) + this.random() * (working ? 0.15 : 0.1);
      const direction = this.random() < 0.5 ? -1 : 1;
      const offset = working ? 0.5 : 0.2;

      this.morphTo({
        scale: this.restScale * (1 + direction * variance),
        x: (this.random() * 2 - 1) * offset,
        y: (this.random() * 2 - 1) * offset,
      });
      this.nextTargetAt =
        this.age + (working ? 600 : 1500) + this.random() * (working ? 300 : 1000);
    } else if (this.state === "waiting") {
      const breath = Math.sin((this.age / WAITING_PERIOD_MS) * Math.PI * 2);

      this.morphTo({ scale: this.restScale * (1 + breath * WAITING_VARIANCE), x: 0, y: 0 });
    } else if (this.state === "blocked") {
      const phase = Math.floor(this.age / (BLOCKED_PERIOD_MS / 4)) % 4;

      if (phase === this.phase) return;
      this.phase = phase;
      const pulse = phase === this.index % 2 ? 0.18 : phase === 2 + (this.index % 2) ? -0.18 : 0;

      this.morphTo({ scale: this.restScale * (1 + pulse), x: pulse, y: 0 });
    } else {
      const dot = AGENT_DOTS[this.index]!;
      const delay = (Math.hypot(dot.x - 20, dot.y - 20) / 6) * COMPLETE_STAGGER_MS;
      const phase = this.age < delay ? 0 : this.age < delay + COMPLETE_PULSE_MS ? 1 : 2;

      if (phase === this.phase) return;
      this.phase = phase;
      this.morphTo({ scale: this.restScale * (phase === 1 ? 1.28 : 1), x: 0, y: 0 });
    }
  }
}
