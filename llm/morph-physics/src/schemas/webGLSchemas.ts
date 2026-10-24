import type { Vector4 } from "./physicsSchemas";

/** Optional metadata on a registered mesh (material hints, etc.). */
export type MeshMetadata = Record<string, unknown>;

/** Registered mesh snapshot: id, layout rect, optional metadata. */
export interface MeshData {
  id: string;
  rect: Vector4;
  metadata?: MeshMetadata;
}

export type MeshMap = Map<string, MeshData>;
