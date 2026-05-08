/**
 * Core entry: springs, `FrameLoop`, layout helpers, and morph property registry
 * (position + color registered when this module loads).
 */
export * from "./constants";
export * from "./morphUtils";
export * from "./physics/frameLoop";
export { solveSpring, solveSpringVector4 } from "./physics/springSolver";
export * from "./schemas/physicsSchemas";
export * from "./schemas/springSolverSchemas";
export * from "./schemas/webGLSchemas";
export { morphPropertyRegistry } from "./morphProperties/registry";
export type { MorphProperty } from "./morphProperties/types";
export {
  positionProperty,
  colorProperty,
  brightnessProperty,
} from "./morphProperties/index";
