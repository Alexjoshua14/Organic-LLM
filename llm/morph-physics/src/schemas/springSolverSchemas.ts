import z from "zod";

import { Vector4, vector4 } from "./physicsSchemas";

export const solveParamsSchema = z.object({
  current: z.number().describe("Current value (e.g. position or state variable)"),
  target: z.number().describe("Target value to approach"),
  k: z.number().describe("Spring stiffness constant (k)"),
  c: z.number().describe("Damping coefficient (c)"),
  dt: z.number().describe("Delta time (elapsed time step, in milliseconds)"),
});

export const outputParamsSchema = z.object({
  current: z.number(),
  velocity: z.number(),
});

export type SolveParams = z.infer<typeof solveParamsSchema>;
export type OutputParams = z.infer<typeof outputParamsSchema>;

export const physicsStateSchema = z.object({
  position: z.number(),
  velocity: z.number(),
});

export const springConfigSchema = z.object({
  stiffness: z.number(),
  damping: z.number(),
  mass: z.number(),
  precision: z.number(),
});

export type PhysicsState = z.infer<typeof physicsStateSchema>;
export type SpringConfig = z.infer<typeof springConfigSchema>;

/** @deprecated Prefer morphCurrentState for multi-property morphs. */
export const physicsStateVector4Schema = z.object({
  current: vector4.describe("Current position and size (x, y, w, h)"),
  velocity: vector4.describe("Current velocity for each component (x, y, w, h)"),
});

export interface SpringResult {
  position: Vector4;
  velocity: Vector4;
}

/** @deprecated */
export type PhysicsStateVector4 = z.infer<typeof physicsStateVector4Schema>;

export const HSLASchema = z
  .object({
    h: z.number().min(0).max(360).describe("Hue (0-360)"),
    s: z.number().min(0).max(100).describe("Saturation (0-100%)"),
    l: z.number().min(0).max(100).describe("Lightness (0-100%)"),
    a: z.number().min(0).max(1).describe("Alpha (opacity, 0-1)"),
  })
  .describe("HSLA color");

const morphStateSchema = z
  .object({
    position: vector4.optional(),
    color: HSLASchema.optional(),
    brightness: z.number().min(0).max(1).optional(),
  })
  .passthrough();

export type morphState = z.infer<typeof morphStateSchema>;

export const morphCurrentStateSchema = z.object({
  velocity: vector4,
  current: morphStateSchema,
  target: morphStateSchema,
});

export type morphCurrentState = z.infer<typeof morphCurrentStateSchema>;
