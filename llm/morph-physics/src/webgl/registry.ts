import type { Vector4 } from "../schemas/physicsSchemas";
import type { MeshMap, MeshMetadata, MeshData } from "../schemas/webGLSchemas";

export class MeshRegistry {
  private meshes: MeshMap;

  constructor() {
    this.meshes = new Map();
  }

  register(id: string, rect: Vector4, metadata?: MeshMetadata): void {
    this.meshes.set(id, {
      id,
      rect,
      metadata,
    });
  }

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

  unregister(id: string): void {
    this.meshes.delete(id);
  }

  get(id: string): MeshData | undefined {
    return this.meshes.get(id);
  }

  getAll(): MeshMap {
    return this.meshes;
  }

  has(id: string): boolean {
    return this.meshes.has(id);
  }

  size(): number {
    return this.meshes.size;
  }

  clear(): void {
    this.meshes.clear();
  }
}
