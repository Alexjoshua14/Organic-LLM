import { Vector4 } from "../schemas/physicsSchemas";
import { MeshRegistry } from "./registry";

/**
 * Create a new MeshRegistry instance
 */
export function createMeshRegistry(): MeshRegistry {
  const meshRegistry = new MeshRegistry();

  return meshRegistry;
}

/**
 * Validate that a Vector4 is valid for mesh registration
 *
 * TODO: Implement
 */
export function validateMeshRect(rect: Vector4): boolean {
  return true;
}
