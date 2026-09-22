"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

import { cn } from "@/lib/utils";

/**
 * FluidGlass — a transmissive 3D slab layered over the bar's CSS glass.
 *
 * ## What this can and cannot do
 *
 * WebGL cannot refract the DOM pixels behind its own canvas — nothing can, short of rasterizing
 * the page into a texture every frame. So the bar is deliberately **two materials stacked**:
 *
 * 1. A CSS `backdrop-filter` on the bar shell does the actual page blur (the shell owns that,
 *    not us).
 * 2. This canvas sits on top and contributes only what CSS cannot — moving specular, chromatic
 *    dispersion at the edges, and a faint thickness tint.
 *
 * ## Why there is no backdrop plane
 *
 * The first version put an opaque coloured plane behind the slab "for the transmission to
 * refract". Two bugs came out of that. The plane rendered as a flat colour block rather than
 * anything glass-like, and the slab was sized in fixed world units (`9 × 1.05`) against a canvas
 * whose aspect ratio is roughly 45:1 — so it covered about a fifth of the bar's width and read
 * as a green rectangle floating in the middle.
 *
 * Both are fixed here by construction: the slab is sized from {@link useThree}'s viewport so it
 * always fills the canvas, and there is nothing opaque in the scene at all. Transmission samples
 * a transparent buffer, so the slab contributes light rather than colour, and any pixel the
 * lighting does not touch stays fully transparent — the CSS glass shows through untouched.
 */

/** Transmission sample count. 4 is the lowest that avoids visible banding at this size. */
const TRANSMISSION_SAMPLES = 4;
/** Off-screen buffer edge for the transmission pass. */
const TRANSMISSION_RESOLUTION = 96;
/**
 * Oversize factor on the pane. Its edges must sit outside the frustum at all times — a visible
 * edge inside a 32px bar reads as a seam, not as glass.
 */
const PANE_OVERSCAN = 1.15;

/** `time` is a uniform the material reads; it is not part of three's `Material` surface. */
type TimedMaterial = THREE.Material & { time?: number };

function Slab({ tint, paused }: { tint: string; paused: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  // World-space size of the canvas at z=0. Recomputed by R3F on every resize, which is what
  // keeps the pane covering the full bar at any width.
  const { width, height } = useThree((state) => state.viewport);

  useFrame((state) => {
    if (paused) return;

    const mesh = meshRef.current;

    if (!mesh) return;

    // Driving the uniform through the mesh avoids a per-frame prop update, which would
    // re-render the React tree sixty times a second for a value only the GPU reads.
    //
    // All motion lives in this uniform. An earlier version also rotated the mesh, which on a
    // pane this wide swung its corners through the near plane and tore visible wedges out of
    // the material. Distortion gives the same living quality with no geometry moving at all.
    (mesh.material as TimedMaterial).time = state.clock.elapsedTime;
  });

  /* R3F intrinsics carry THREE constructor props; eslint-plugin-react does not know them. */
  /* eslint-disable react/no-unknown-property */
  return (
    <>
      {/*
        Lightformers must live inside `Environment`. On their own they are ordinary emissive
        meshes and render as visible white rectangles — which is exactly what the pane was
        refracting into white triangular wedges. Inside `Environment` they are baked into a
        cubemap: they light the glass and are never drawn.
      */}
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={2.4} position={[-3, 1.2, 2]} scale={[6, 1.4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[3.5, -1, 1.6]} scale={[5, 1, 1]} />
        <Lightformer form="rect" intensity={0.6} position={[0, 2.5, -1]} scale={[8, 2, 1]} />
      </Environment>

      <mesh ref={meshRef} scale={[width * PANE_OVERSCAN, height * PANE_OVERSCAN, 1]}>
        {/*
          A plane, not a box. Thickness is a material parameter here, so geometry depth buys
          nothing — and a box this wide produced backside-pass artifacts at the ends.
        */}
        <planeGeometry args={[1, 1]} />
        <MeshTransmissionMaterial
          anisotropicBlur={0.4}
          // A whisper of colour in the thick parts only. `attenuationColor` tints by path length
          // through the glass, so it can never flatten into a solid block the way a backdrop can.
          attenuationColor={tint}
          attenuationDistance={3}
          // Backside needs a closed volume; on a plane it renders garbage.
          backside={false}
          chromaticAberration={0.2}
          distortion={0.35}
          distortionScale={0.5}
          ior={1.2}
          resolution={TRANSMISSION_RESOLUTION}
          roughness={0.15}
          samples={TRANSMISSION_SAMPLES}
          temporalDistortion={0.12}
          thickness={0.25}
          transmission={1}
        />
      </mesh>
    </>
  );
  /* eslint-enable react/no-unknown-property */
}

export type VoiceFluidGlassProps = {
  /** Thickness tint, applied via attenuation. Defaults to the app's accent teal. */
  tint?: string;
  className?: string;
};

export function VoiceFluidGlass({ tint = "#1f8f77", className }: VoiceFluidGlassProps) {
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const sync = () => setPaused(Boolean(reduced) || document.hidden);

    sync();
    document.addEventListener("visibilitychange", sync);

    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // A lost or unavailable WebGL context must leave the CSS glass alone rather than painting a
  // dead canvas over it.
  if (failed) return null;

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      <Canvas
        camera={{ fov: 22, position: [0, 0, 6] }}
        dpr={[1, 1.5]}
        // `demand` while paused means zero frames rendered, not throttled frames.
        frameloop={paused ? "demand" : "always"}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => setFailed(true), { once: true });
        }}
      >
        <Slab paused={paused} tint={tint} />
      </Canvas>
    </div>
  );
}
