"use client";

import type { AnchorWorld } from "../_lib/lens/uniforms";
import type { ParticleFieldVisualState } from "../_lib/types";
import type { LensPerfMetrics } from "./lens/LensPerfHud";

import { useReducedMotion } from "framer-motion";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

import {
  PULSE_DECAY_INTERVAL_MS,
  PULSE_EPSILON,
  PULSE_GLOW_DECAY,
  PULSE_INHALE_DECAY,
} from "../_lib/memory-ingest-tuning";
import { attachForegroundThemeProbe } from "../_lib/theme-particle-colors";

import { MemoryLens } from "./lens/MemoryLens";
import { MemoryParticleReducedMotion } from "./MemoryParticleReducedMotion";

export type ParticleFieldHandle = {
  pulseWritingMemory: () => void;
  /** Fire the "message received" inhale beat (cloud gathers toward the composer, then settles). */
  pulseReceived: () => void;
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
    const pulseInhaleRef = useRef(0);
    const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cameraRef = useRef(new THREE.PerspectiveCamera(60, 1, 0.1, 200));

    // The transient pulses decay on a short self-terminating timer that runs only while a
    // pulse is live — no perpetual 32ms wakeup when the field is at rest.
    const runDecay = useCallback(() => {
      pulseRef.current *= PULSE_GLOW_DECAY;
      pulseInhaleRef.current *= PULSE_INHALE_DECAY;
      if (pulseRef.current < PULSE_EPSILON && pulseInhaleRef.current < PULSE_EPSILON) {
        pulseRef.current = 0;
        pulseInhaleRef.current = 0;
        decayTimerRef.current = null;

        return;
      }
      decayTimerRef.current = setTimeout(runDecay, PULSE_DECAY_INTERVAL_MS);
    }, []);

    const startDecay = useCallback(() => {
      if (prefersReduced === true || decayTimerRef.current !== null) return;
      decayTimerRef.current = setTimeout(runDecay, PULSE_DECAY_INTERVAL_MS);
    }, [prefersReduced, runDecay]);

    useImperativeHandle(ref, () => ({
      pulseWritingMemory: () => {
        pulseRef.current = 1;
        startDecay();
      },
      pulseReceived: () => {
        pulseInhaleRef.current = 1;
        startDecay();
      },
      resetToIdle: () => {
        pulseRef.current = 0;
        pulseInhaleRef.current = 0;
      },
    }));

    useEffect(
      () => () => {
        if (decayTimerRef.current !== null) {
          clearTimeout(decayTimerRef.current);
          decayTimerRef.current = null;
        }
      },
      []
    );

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

      // Reused across frames — the anchor solve only runs during the brief inhale, and even
      // then it must not allocate per frame (GC churn was feeding jank into the gesture).
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();

      const loop = () => {
        const container = containerRef.current;
        const anchor = inputAnchorRef?.current;
        // uAnchor is consumed only while the inhale pull is active (strength = inhale * MAX);
        // once it has settled, skip the raycast entirely.
        const anchorActive = pulseInhaleRef.current > PULSE_EPSILON;

        if (anchorActive && container && anchor) {
          const rect = container.getBoundingClientRect();
          const ar = anchor.getBoundingClientRect();

          cam.aspect = rect.width / Math.max(1, rect.height);
          cam.updateProjectionMatrix();
          ndc.set(
            ((ar.left + ar.width / 2 - rect.left) / rect.width) * 2 - 1,
            -((ar.top + ar.height * 0.35 - rect.top) / rect.height) * 2 + 1
          );
          raycaster.setFromCamera(ndc, cam);

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
          pulseInhaleRef={pulseInhaleRef}
          state={state}
          themeProbeRef={themeProbeRef}
        />
      </div>
    );
  }
);
