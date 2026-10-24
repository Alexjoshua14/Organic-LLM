import type { Vector4 } from "../schemas/physicsSchemas";

import { MeshRegistry } from "./registry";

export function createMeshRegistry(): MeshRegistry {
  return new MeshRegistry();
}

/** Placeholder rect check (always true); tighten when wiring strict WebGL layouts. */
export function validateMeshRect(_rect: Vector4): boolean {
  return true;
}
