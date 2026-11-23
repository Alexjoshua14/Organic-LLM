import type { Vector4 } from "../schemas/physicsSchemas";

import { regular_spring_config } from "../constants";

import { solveSpring } from "./springSolver";

export type Volume = Vector4 & { z: number; thickness: number };
export type VolumeBounds = Pick<Volume, "w" | "h" | "thickness">;
export type VolumeResponse = "fixed" | "yielding";

export interface VolumePiece {
  id: string;
  volume: Volume;
  origin?: "user" | "auto";
  response?: VolumeResponse;
  /** Greater importance gives up less space. */
  importance?: number;
}

const axes = [
  ["x", "w"],
  ["y", "h"],
  ["z", "thickness"],
] as const;
const fields = ["x", "y", "z", "w", "h", "thickness"] as const;
const epsilon = 1e-9;
const contactDurationMs = 180;
const maxSpringStepMs = 16;

function interpolate(start: Volume, end: Volume, t: number): Volume {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
    w: start.w + (end.w - start.w) * t,
    h: start.h + (end.h - start.h) * t,
    thickness: start.thickness + (end.thickness - start.thickness) * t,
  };
}

export function volumeFits(volume: Volume, bounds: VolumeBounds): boolean {
  return axes.every(
    ([position, size]) =>
      Number.isFinite(bounds[size]) &&
      bounds[size] > 0 &&
      Number.isFinite(volume[position]) &&
      Number.isFinite(volume[size]) &&
      volume[position] >= -epsilon &&
      volume[size] > 0 &&
      volume[position] + volume[size] <= bounds[size] + epsilon
  );
}

/** First overlap along simultaneous linear translation and resizing. Touching faces are valid. */
export function volumeContact(
  a: Volume,
  aEnd: Volume,
  b: Volume,
  bEnd: Volume,
  gutter = 0
): number {
  let enter = 0;
  let exit = 1;

  for (const [position, size] of axes) {
    const gap = position === "z" ? 0 : gutter;
    const separation = [
      [
        a[position] + a[size] + gap - b[position],
        aEnd[position] + aEnd[size] + gap - bEnd[position],
      ],
      [
        b[position] + b[size] + gap - a[position],
        bEnd[position] + bEnd[size] + gap - aEnd[position],
      ],
    ];

    for (const [from, to] of separation) {
      if (from <= epsilon && to <= epsilon) return 1;
      if (from <= epsilon) enter = Math.max(enter, Math.max(0, -from) / (to - from));
      if (to <= epsilon) exit = Math.min(exit, from / (from - Math.min(to, 0)));
    }
  }

  return enter < exit ? enter : 1;
}

export function volumeResponse(piece: VolumePiece): VolumeResponse {
  return piece.response ?? (piece.origin === "auto" ? "yielding" : "fixed");
}

interface VolumePlan {
  targets: Volume[];
  blocked: boolean;
}

function safeProgress(
  pieces: readonly VolumePiece[],
  targets: readonly Volume[],
  bounds: VolumeBounds,
  gutter: number
) {
  let progress = 1;

  for (let i = 0; i < pieces.length; i++) {
    const start = pieces[i].volume;
    const end = targets[i];

    for (const [position, size] of axes) {
      const margins = [
        [start[position], end[position]],
        [bounds[size] - start[position] - start[size], bounds[size] - end[position] - end[size]],
      ];

      for (const [from, to] of margins) {
        if (to < -epsilon) progress = Math.min(progress, Math.max(0, from / (from - to)));
      }
    }
    for (let j = 0; j < i; j++) {
      progress = Math.min(
        progress,
        volumeContact(start, end, pieces[j].volume, targets[j], gutter)
      );
    }
  }

  return progress;
}

function planVolumeMove(
  pieces: readonly VolumePiece[],
  index: number,
  target: Volume,
  bounds: VolumeBounds,
  gutter: number
): VolumePlan {
  const mover = pieces[index];
  const targets = pieces.map((piece, i) => (i === index ? target : piece.volume));

  for (let i = 0; i < pieces.length; i++) {
    const neighbor = pieces[i];

    if (i === index || volumeResponse(neighbor) !== "yielding") continue;
    const current = targets[index];
    const contact = volumeContact(mover.volume, current, neighbor.volume, neighbor.volume, gutter);

    if (contact === 1) continue;
    const atContact = interpolate(mover.volume, current, contact);
    const options = axes
      .slice(0, 2)
      .flatMap(([position, size]) => [
        {
          position,
          distance: neighbor.volume[position] - gutter - current[position] - current[size],
          separation: neighbor.volume[position] - gutter - atContact[position] - atContact[size],
          side: -1,
        },
        {
          position,
          distance: neighbor.volume[position] + neighbor.volume[size] + gutter - current[position],
          separation:
            atContact[position] - neighbor.volume[position] - neighbor.volume[size] - gutter,
          side: 1,
        },
      ])
      .filter(({ separation, distance, side }) => separation >= -epsilon && distance * side >= 0)
      .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
    const option = options[0];

    if (!option) continue;
    const { position, distance } = option;
    const moverWeight = mover.importance ?? 1;
    const neighborWeight = neighbor.importance ?? 1;
    const neighborShare =
      volumeResponse(mover) === "fixed" ? 1 : 1 / (1 + neighborWeight / moverWeight);
    const candidate = [...targets];

    candidate[index] = {
      ...current,
      [position]: current[position] + distance * (1 - neighborShare),
    };
    candidate[i] = {
      ...neighbor.volume,
      [position]: neighbor.volume[position] - distance * neighborShare,
    };
    if (safeProgress(pieces, candidate, bounds, gutter) === 1) {
      targets[index] = candidate[index];
      targets[i] = candidate[i];
    }
  }
  const progress = safeProgress(pieces, targets, bounds, gutter);

  return {
    targets: targets.map((end, i) => interpolate(pieces[i].volume, end, progress)),
    blocked: progress < 1,
  };
}

/** Mutable animation controller with immutable snapshots. Coordinates are near-face origins. */
export class VolumeScene {
  private pieces: VolumePiece[] = [];
  private motion?: {
    starts: VolumePiece[];
    plan: VolumePlan;
    progress: number;
    velocity: number;
    id: string;
  };
  private feedback = 0;
  private lastContact?: string;

  readonly bounds: Readonly<VolumeBounds>;

  constructor(
    bounds: VolumeBounds,
    readonly gutter = 0
  ) {
    if (axes.some(([, size]) => !Number.isFinite(bounds[size]) || bounds[size] <= 0)) {
      throw new RangeError("Invalid volume bounds");
    }
    if (!Number.isFinite(gutter) || gutter < 0) throw new RangeError("Invalid gutter");
    this.bounds = { ...bounds };
  }

  get snapshot(): readonly VolumePiece[] {
    return this.pieces;
  }
  get active(): boolean {
    return Boolean(this.motion) || this.feedback > 0;
  }
  /** A bounded 0–1 contact pulse for a renderer to consume without offsetting geometry. */
  get contactFeedback(): number {
    return this.feedback;
  }
  get contactPieceId(): string | undefined {
    return this.feedback > 0 ? this.lastContact : undefined;
  }

  place(piece: VolumePiece): boolean {
    const { id, volume, importance = 1 } = piece;

    if (!id || !Number.isFinite(importance) || importance <= 0 || !volumeFits(volume, this.bounds))
      return false;
    if (
      this.pieces.some(
        (other, index) =>
          other.id === id ||
          volumeContact(
            volume,
            volume,
            other.volume,
            this.motion?.plan.targets[index] ?? other.volume,
            this.gutter
          ) < 1
      )
    )
      return false;
    const placed = { ...piece, volume: { ...volume } };

    this.pieces = [...this.pieces, placed];
    if (this.motion) {
      this.motion.starts = [...this.motion.starts, placed];
      this.motion.plan.targets = [...this.motion.plan.targets, placed.volume];
    }

    return true;
  }

  move(id: string, target: Volume): "moving" | "blocked" | "invalid" {
    const index = this.pieces.findIndex((piece) => piece.id === id);

    if (
      index < 0 ||
      fields.some((field) => !Number.isFinite(target[field])) ||
      axes.some(([, size]) => target[size] <= 0)
    )
      return "invalid";
    const starts = this.pieces;
    const plan = planVolumeMove(starts, index, target, this.bounds, this.gutter);
    const previous = this.motion;
    let velocity = 0;

    if (previous?.id === id) {
      // Project the current geometry velocity onto the new collision-safe path.
      const displacement = fields.map(
        (field) => plan.targets[index][field] - starts[index].volume[field]
      );
      const lengthSquared = displacement.reduce((sum, value) => sum + value ** 2, 0);
      const dot = fields.reduce(
        (sum, field, i) =>
          sum +
          displacement[i] *
            (previous.plan.targets[index][field] - previous.starts[index].volume[field]),
        0
      );

      if (lengthSquared > epsilon)
        velocity = Math.min(
          1 / regular_spring_config.precision,
          Math.max(0, (previous.velocity * dot) / lengthSquared)
        );
    }
    this.feedback = 0;
    this.motion = { starts, plan, progress: 0, velocity, id };

    return plan.blocked ? "blocked" : "moving";
  }

  step(milliseconds: number, instant = false): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    this.feedback = instant ? 0 : Math.max(0, this.feedback - milliseconds / contactDurationMs);
    const motion = this.motion;

    if (!motion || (milliseconds === 0 && !instant)) return;
    const next = instant
      ? { position: 1, velocity: 0 }
      : solveSpring(
          motion.progress,
          1,
          motion.velocity,
          regular_spring_config,
          Math.min(milliseconds, maxSpringStepMs)
        );
    const settled =
      next.position >= 1 ||
      (1 - next.position < regular_spring_config.precision &&
        Math.abs(next.velocity) < regular_spring_config.precision);

    motion.progress = settled ? 1 : Math.max(motion.progress, next.position);
    motion.velocity = next.velocity;
    this.pieces = motion.starts.map((piece, i) => ({
      ...piece,
      volume: interpolate(piece.volume, motion.plan.targets[i], motion.progress),
    }));
    if (settled) {
      this.motion = undefined;
      if (motion.plan.blocked && !instant) {
        this.lastContact = motion.id;
        this.feedback = 1;
      }
    }
  }
}
