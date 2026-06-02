/** Optional Three.js mesh registry React context + helpers. Peer: `three`. */
export { MeshRegistry } from "./webgl/registry";
export { createMeshRegistry, validateMeshRect } from "./webgl/webGLUtils";
export { MeshRegistryProvider, useMeshRegistry } from "./webgl/meshRegistryContext";
export type { MeshData, MeshMap, MeshMetadata } from "./schemas/webGLSchemas";
