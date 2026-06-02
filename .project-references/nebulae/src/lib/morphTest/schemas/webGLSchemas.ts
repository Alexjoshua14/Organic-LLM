import { Vector4 } from "./physicsSchemas";

/**
 * Metadata for a synced mesh (optional properties like color, material, etc.)
 */
export type MeshMetadata = Record<string, unknown>;

/**
 * Data structure for a registered mesh
 */
export interface MeshData {
  id: string;
  rect: Vector4; // Position and size (x, y, w, h) in container-relative pixels
  metadata?: MeshMetadata;
}

/**
 * Map of mesh ID to mesh data
 */
export type MeshMap = Map<string, MeshData>;
