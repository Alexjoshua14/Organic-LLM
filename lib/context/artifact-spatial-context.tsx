"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import {
  ArtifactSpatialStore,
  createArtifactSpatialStore,
} from "@/lib/spatial-artifacts/artifact-spatial-store";

type ArtifactSpatialContextValue = {
  store: ArtifactSpatialStore;
  stageRef: RefObject<HTMLDivElement | null>;
};

const ArtifactSpatialContext = createContext<ArtifactSpatialContextValue | null>(null);

export function ArtifactSpatialProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<ArtifactSpatialStore | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  if (!storeRef.current) {
    storeRef.current = createArtifactSpatialStore();
  }

  const value = useMemo(
    () => ({
      store: storeRef.current!,
      stageRef,
    }),
    []
  );

  return (
    <ArtifactSpatialContext.Provider value={value}>{children}</ArtifactSpatialContext.Provider>
  );
}

export function useArtifactSpatial(): ArtifactSpatialContextValue {
  const ctx = useContext(ArtifactSpatialContext);

  if (!ctx) {
    throw new Error("useArtifactSpatial must be used within ArtifactSpatialProvider");
  }

  return ctx;
}
