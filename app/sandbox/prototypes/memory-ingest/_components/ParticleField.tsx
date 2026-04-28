"use client";

import type { AnchorWorld } from "../_lib/lens/uniforms";
import type { ParticleFieldVisualState } from "../_lib/types";
import type { LensPerfMetrics } from "./lens/LensPerfHud";

import { useReducedMotion } from "framer-motion";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

import { attachForegroundThemeProbe } from "../_lib/theme-particle-colors";

import { MemoryLens } from "./lens/MemoryLens";
import { MemoryParticleReducedMotion } from "./MemoryParticleReducedMotion";

export type ParticleFieldHandle = {
  pulseWritingMemory: () => void;
  resetToIdle: () => void;
};

export type ParticleFieldProps = {
  state: ParticleFieldVisualState;
  intensity?: number;
  className?: string;
  /** Element used to aim “listening” pull toward the composer (e.g. CoreInput wrapper). */
  inputAnchorRef?: React.RefObject<HTMLElement | null>;
  /** Test / story override: bypass WebGL when true. */
  forceReducedMotion?: boolean;
  devUiEnabled?: boolean;
  onPerfSample?: (metrics: LensPerfMetrics) => void;
};

export const ParticleField = forwardRef<ParticleFieldHandle, ParticleFieldProps>(
  function ParticleField(
    {
      state,
      intensity = 0.45,
      className,
      inputAnchorRef,
      forceReducedMotion,
      devUiEnabled = false,
      onPerfSample,
    },
    ref
  ) {
    const hookReduced = useReducedMotion();
    const prefersReduced = forceReducedMotion === true || hookReduced === true;
    const containerRef = useRef<HTMLDivElement>(null);
    const themeProbeRef = useRef<HTMLElement | null>(null);
    const anchorWorldRef = useRef<AnchorWorld>(null);
    const pulseRef = useRef(0);
    const cameraRef = useRef(new THREE.PerspectiveCamera(60, 1, 0.1, 200));

    useImperativeHandle(ref, () => ({
      pulseWritingMemory: () => {
        pulseRef.current = 1;
      },
      resetToIdle: () => {
        pulseRef.current = 0;
      },
    }));

    useEffect(() => {
      if (prefersReduced === true) return;
      const id = window.setInterval(() => {
        pulseRef.current *= 0.9;
      }, 32);

      return () => window.clearInterval(id);
    }, [prefersReduced]);

    useEffect(() => {
      if (prefersReduced === true) return;
      const el = containerRef.current;

      if (!el) return;
      const { element: themeProbe, remove } = attachForegroundThemeProbe(el);

      themeProbeRef.current = themeProbe;

      return () => {
        themeProbeRef.current = null;
        remove();
      };
    }, [prefersReduced]);

    useEffect(() => {
      if (prefersReduced === true) return;
      let raf = 0;
      const cam = cameraRef.current;

      cam.position.set(0, 0, 22);

      const loop = () => {
        const container = containerRef.current;
        const anchor = inputAnchorRef?.current;

        if (container && anchor) {
          const rect = container.getBoundingClientRect();
          const ar = anchor.getBoundingClientRect();

          cam.aspect = rect.width / Math.max(1, rect.height);
          cam.updateProjectionMatrix();
          const ndcX = ((ar.left + ar.width / 2 - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((ar.top + ar.height * 0.35 - rect.top) / rect.height) * 2 + 1;
          const raycaster = new THREE.Raycaster();

          raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
          const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
          const hit = new THREE.Vector3();

          if (raycaster.ray.intersectPlane(plane, hit)) {
            anchorWorldRef.current = { x: hit.x, y: hit.y };
          }
        } else {
          anchorWorldRef.current = null;
        }
        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);

      return () => cancelAnimationFrame(raf);
    }, [inputAnchorRef, prefersReduced]);

    if (prefersReduced === true) {
      return (
        <div className={className} ref={containerRef}>
          <MemoryParticleReducedMotion state={state} />
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: "min(42vh, 360px)",
        }}
      >
        <MemoryLens
          anchorWorldRef={anchorWorldRef}
          devUiEnabled={devUiEnabled}
          intensity={intensity}
          onPerfSample={onPerfSample}
          pulseGlowRef={pulseRef}
          state={state}
          themeProbeRef={themeProbeRef}
        />
      </div>
    );
  }
);
