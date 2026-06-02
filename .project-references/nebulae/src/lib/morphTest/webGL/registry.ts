import { Vector4 } from "../schemas/physicsSchemas";
import { MeshMap, MeshMetadata, MeshData } from "../schemas/webGLSchemas";

export class MeshRegistry {
  private meshes: MeshMap;

  constructor() {
    this.meshes = new Map();
  }

  /**
   * Register a new mesh or update an existing one
   */
  register(id: string, rect: Vector4, metadata?: MeshMetadata): void {
    this.meshes.set(id, {
      id,
      rect,
      metadata,
    });
  }

  /**
   * Update an existing mesh's position/size
   */
  update(id: string, rect: Vector4): void {
    const mesh = this.meshes.get(id);

    if (mesh) {
      this.meshes.set(id, {
        ...mesh,
        rect,
      });
    } else {
      throw new Error("Mesh does not exist");
    }
  }

  /**
   * Remove a mesh from the registry
   */
  unregister(id: string): void {
    this.meshes.delete(id);
  }

  /**
   * Get a specific mesh by ID
   */
  get(id: string): MeshData | undefined {
    return this.meshes.get(id);
  }

  /**
   * Get all registered meshes
   */
  getAll(): MeshMap {
    return this.meshes;
  }

  /**
   * Check if a mesh exists
   */
  has(id: string): boolean {
    return this.meshes.has(id);
  }

  /**
   * Get the number of registered meshes
   */
  size(): number {
    return this.meshes.size;
  }

  /**
   * Clear all meshes
   */
  clear(): void {
    this.meshes.clear();
  }
}
