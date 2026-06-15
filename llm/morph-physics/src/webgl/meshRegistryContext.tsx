import type { Vector4 } from "../schemas/physicsSchemas";
import type { MeshMetadata, MeshData } from "../schemas/webGLSchemas";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

import { MeshRegistry } from "./registry";

type MeshChangeCallback = (id: string, mesh: MeshData | null) => void;

interface MeshRegistryContextValue {
  registerMesh: (id: string, rect: Vector4, metadata?: MeshMetadata) => void;
  updateMesh: (id: string, rect: Vector4) => void;
  unregisterMesh: (id: string) => void;
  getMesh: (id: string) => MeshData | undefined;
  getAllMeshes: () => Map<string, MeshData>;
  subscribe: (callback: MeshChangeCallback) => () => void;
}

const MeshRegistryContext = createContext<MeshRegistryContextValue | undefined>(undefined);

interface MeshRegistryProviderProps {
  children: ReactNode;
}

export function MeshRegistryProvider({ children }: MeshRegistryProviderProps) {
  const registryRef = useRef<MeshRegistry>(new MeshRegistry());
  const subscribersRef = useRef<Set<MeshChangeCallback>>(new Set());

  const notifySubscribers = useCallback((id: string, mesh: MeshData | null) => {
    subscribersRef.current.forEach((callback) => {
      callback(id, mesh);
    });
  }, []);

  const registerMesh = useCallback(
    (id: string, rect: Vector4, metadata?: MeshMetadata) => {
      registryRef.current.register(id, rect, metadata);
      const mesh = registryRef.current.get(id);

      if (mesh) {
        notifySubscribers(id, mesh);
      }
    },
    [notifySubscribers]
  );

  const updateMesh = useCallback(
    (id: string, rect: Vector4) => {
      registryRef.current.update(id, rect);
      const mesh = registryRef.current.get(id);

      if (mesh) {
        notifySubscribers(id, mesh);
      }
    },
    [notifySubscribers]
  );

  const unregisterMesh = useCallback(
    (id: string) => {
      registryRef.current.unregister(id);
      notifySubscribers(id, null);
    },
    [notifySubscribers]
  );

  const getMesh = useCallback((id: string) => {
    return registryRef.current.get(id);
  }, []);

  const getAllMeshes = useCallback(() => {
    return registryRef.current.getAll();
  }, []);

  const subscribe = useCallback((callback: MeshChangeCallback) => {
    subscribersRef.current.add(callback);

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

  return <MeshRegistryContext.Provider value={value}>{children}</MeshRegistryContext.Provider>;
}

export function useMeshRegistry(): MeshRegistryContextValue {
  const context = useContext(MeshRegistryContext);

  if (!context) {
    throw new Error("useMeshRegistry must be used within a MeshRegistryProvider");
  }

  return context;
}
