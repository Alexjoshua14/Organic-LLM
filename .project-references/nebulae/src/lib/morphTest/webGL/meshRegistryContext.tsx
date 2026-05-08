// src/lib/morphTest/webGL/meshRegistryContext.tsx

import { createContext, useContext, useRef, useCallback, ReactNode } from "react";
import { MeshRegistry } from "@/lib/morphTest/webGL/registry";
import { Vector4 } from "@/lib/morphTest/schemas/physicsSchemas";
import { MeshMetadata, MeshData } from "@/lib/morphTest/schemas/webGLSchemas";


/**
 * Callback function type for mesh change events
 * Called when a mesh is registered, updated, or unregistered
 */
type MeshChangeCallback = (id: string, mesh: MeshData | null) => void;

/**
 * Context value type - the API provided to consumers
 */
interface MeshRegistryContextValue {
  /**
   * Register a new mesh or update an existing one
   * Should call registry.register() and notify subscribers
   */
  registerMesh: (id: string, rect: Vector4, metadata?: MeshMetadata) => void;

  /**
   * Update an existing mesh's position/size
   * Should call registry.update() and notify subscribers
   */
  updateMesh: (id: string, rect: Vector4) => void;

  /**
   * Remove a mesh from the registry
   * Should call registry.unregister() and notify subscribers
   */
  unregisterMesh: (id: string) => void;

  /**
   * Get a specific mesh by ID
   */
  getMesh: (id: string) => MeshData | undefined;

  /**
   * Get all registered meshes
   */
  getAllMeshes: () => Map<string, MeshData>;

  /**
   * Subscribe to mesh changes
   * Returns an unsubscribe function
   * 
   * HINT: Store callbacks in a Set or Map, return a cleanup function
   */
  subscribe: (callback: MeshChangeCallback) => () => void;
}

/**
 * Create the context with undefined default (will throw if used outside Provider)
 */
const MeshRegistryContext = createContext<MeshRegistryContextValue | undefined>(
  undefined
);

/**
 * Provider component that wraps the MeshRegistry
 * 
 * HINTS:
 * - Use useRef to store the MeshRegistry instance (persists, no re-renders)
 * - Use useRef to store subscribers (Set<MeshChangeCallback>)
 * - Wrap API methods in useCallback for stability
 * - In each method, call the registry method, then notify all subscribers
 */
interface MeshRegistryProviderProps {
  children: ReactNode;
}

export function MeshRegistryProvider({ children }: MeshRegistryProviderProps) {
  // Create registry instance with useRef (persists across renders, no re-renders)
  const registryRef = useRef<MeshRegistry>(new MeshRegistry());

  // Store subscribers (Set of callbacks)
  const subscribersRef = useRef<Set<MeshChangeCallback>>(new Set());

  /**
   * Notify all subscribers of a mesh change
   */
  const notifySubscribers = useCallback((id: string, mesh: MeshData | null) => {
    subscribersRef.current.forEach((callback) => {
      callback(id, mesh);
    });
  }, []);

  /**
   * Register a mesh
   */
  const registerMesh = useCallback((id: string, rect: Vector4, metadata?: MeshMetadata) => {
    registryRef.current.register(id, rect, metadata);
    const mesh = registryRef.current.get(id);
    if (mesh) {
      notifySubscribers(id, mesh);
    }
  }, [notifySubscribers]);

  /**
   * Update a mesh
   */
  const updateMesh = useCallback((id: string, rect: Vector4) => {
    registryRef.current.update(id, rect);
    const mesh = registryRef.current.get(id);
    if (mesh) {
      notifySubscribers(id, mesh);
    }
  }, [notifySubscribers]);

  /**
   * Unregister a mesh
   */
  const unregisterMesh = useCallback((id: string) => {
    registryRef.current.unregister(id);
    notifySubscribers(id, null);
  }, [notifySubscribers]);

  /**
   * Get a mesh
   */
  const getMesh = useCallback((id: string) => {
    return registryRef.current.get(id);
  }, []);

  /**
   * Get all meshes
   */
  const getAllMeshes = useCallback(() => {
    return registryRef.current.getAll();
  }, []);

  /**
   * Subscribe to mesh changes
   * Returns an unsubscribe function
   */
  const subscribe = useCallback((callback: MeshChangeCallback) => {
    subscribersRef.current.add(callback);
    // Return cleanup function that removes callback
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const value: MeshRegistryContextValue = {
    registerMesh,
    updateMesh,
    unregisterMesh,
    getMesh,
    getAllMeshes,
    subscribe,
  };

  return (
    <MeshRegistryContext.Provider value={value}>
      {children}
    </MeshRegistryContext.Provider>
  );
}

/**
 * Custom hook to consume the MeshRegistryContext
 * Throws an error if used outside of MeshRegistryProvider
 */
export function useMeshRegistry(): MeshRegistryContextValue {
  const context = useContext(MeshRegistryContext);
  if (!context) {
    throw new Error(
      "useMeshRegistry must be used within a MeshRegistryProvider"
    );
  }
  return context;
}