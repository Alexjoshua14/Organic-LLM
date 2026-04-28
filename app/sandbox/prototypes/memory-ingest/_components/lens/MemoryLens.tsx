"use client";

import type { MutableRefObject } from "react";
import type { StateName } from "../../_lib/lens/fieldLibrary";
import type { AnchorWorld } from "../../_lib/lens/uniforms";

import { Canvas } from "@react-three/fiber";

import { getDeviceTier, getMemoryIngestTierDefaults } from "../../_lib/lens/device-tier";

import { LensPoints } from "./LensPoints";

export type MemoryLensProps = {
  state: StateName;
  intensity: number;
  themeProbeRef: MutableRefObject<HTMLElement | null>;
  pulseGlowRef: MutableRefObject<number>;
  anchorWorldRef: MutableRefObject<AnchorWorld>;
};

export function MemoryLens({
  state,
  intensity,
  themeProbeRef,
  pulseGlowRef,
  anchorWorldRef,
}: MemoryLensProps) {
  const tier = typeof window !== "undefined" ? getDeviceTier() : "desktop";
  const { count, pointSize, pixelRatioCap } = getMemoryIngestTierDefaults(tier);

  return (
    <Canvas
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 0, 22], fov: 60, near: 0.1, far: 200 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
        gl.domElement.dataset.testid = "memory-particle-webgl";
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    >
      <LensPoints
        anchorWorldRef={anchorWorldRef}
        count={count}
        intensity={intensity}
        pointSize={pointSize}
        pulseGlowRef={pulseGlowRef}
        state={state}
        themeProbeRef={themeProbeRef}
      />
    </Canvas>
  );
}
