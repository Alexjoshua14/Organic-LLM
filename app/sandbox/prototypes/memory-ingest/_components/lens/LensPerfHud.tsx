"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

export type LensPerfMetrics = {
  fps: number;
  meanMs: number;
  p95Ms: number;
  calls: number;
  tris: number;
  count: number;
  dpr: number;
};

export type LensPerfHudProps = {
  count: number;
  /** Callback receives sampled metrics (~5 Hz). */
  onSample: (metrics: LensPerfMetrics) => void;
};

/**
 * Dev-only: samples frame deltas inside the R3F loop and writes stats to `targetRef`.
 */
export function LensPerfHud({ count, onSample }: LensPerfHudProps) {
  const { gl } = useThree();
  const samples = useRef<number[]>([]);
  const last = useRef(performance.now());
  const flushAt = useRef(0);

  useFrame(() => {
    const now = performance.now();

    samples.current.push(now - last.current);
    if (samples.current.length > 120) samples.current.shift();
    last.current = now;

    if (now < flushAt.current) return;

    flushAt.current = now + 200;
    const ms = samples.current;

    if (ms.length === 0) return;

    const sorted = [...ms].sort((a, b) => a - b);
    const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? mean;
    const fps = mean > 0 ? 1000 / mean : 0;
    const calls = gl.info.render.calls;
    const tris = gl.info.render.triangles;
    const dpr = gl.getPixelRatio();

    onSample({ fps, meanMs: mean, p95Ms: p95, calls, tris, count, dpr });
  });

  return null;
}
