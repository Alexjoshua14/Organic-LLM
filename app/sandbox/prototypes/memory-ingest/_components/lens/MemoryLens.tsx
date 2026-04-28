"use client";

import type { MutableRefObject } from "react";
import type { StateName } from "../../_lib/lens/fieldLibrary";
import type { AnchorWorld } from "../../_lib/lens/uniforms";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import { readMemoryIngestDevUiFromSearch } from "../../_lib/memory-ingest-dev-ui";
import { getDeviceTier, getMemoryIngestTierDefaults } from "../../_lib/lens/device-tier";

import { LensPerfHud } from "./LensPerfHud";
import { LensPoints } from "./LensPoints";

export type MemoryLensProps = {
  state: StateName;
  intensity: number;
  themeProbeRef: MutableRefObject<HTMLElement | null>;
  pulseGlowRef: MutableRefObject<number>;
  anchorWorldRef: MutableRefObject<AnchorWorld>;
};

function readParticleCountMul(search: string): number {
  try {
    const raw = Number(new URLSearchParams(search).get("particleCountMul"));

    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.min(6, Math.max(0.25, raw));
  } catch {
    return 1;
  }
}

export function MemoryLens({
  state,
  intensity,
  themeProbeRef,
  pulseGlowRef,
  anchorWorldRef,
}: MemoryLensProps) {
  const tier = typeof window !== "undefined" ? getDeviceTier() : "desktop";
  const { count, pointSize, pixelRatioCap } = getMemoryIngestTierDefaults(tier);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const [lensDevHud, setLensDevHud] = useState(false);
  const [particleCountMul, setParticleCountMul] = useState(1);

  useEffect(() => {
    setLensDevHud(readMemoryIngestDevUiFromSearch(window.location.search));
    setParticleCountMul(readParticleCountMul(window.location.search));
  }, []);

  const effectiveCount = lensDevHud
    ? Math.max(1, Math.round(count * particleCountMul))
    : count;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {lensDevHud ? (
        <div
          ref={hudRef}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 10,
            maxWidth: "calc(100% - 16px)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            lineHeight: 1.35,
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 1px 2px rgba(0,0,0,0.85)",
            pointerEvents: "none",
            whiteSpace: "pre-wrap",
          }}
        />
      ) : null}
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
          count={effectiveCount}
          intensity={intensity}
          pointSize={pointSize}
          pulseGlowRef={pulseGlowRef}
          state={state}
          themeProbeRef={themeProbeRef}
        />
        {lensDevHud ? <LensPerfHud count={effectiveCount} targetRef={hudRef} /> : null}
      </Canvas>
    </div>
  );
}
