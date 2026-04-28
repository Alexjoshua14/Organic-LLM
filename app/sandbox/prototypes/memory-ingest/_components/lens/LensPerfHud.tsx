"use client";

import type { MutableRefObject } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

export type LensPerfHudProps = {
  count: number;
  /** DOM node updated imperatively (~5 Hz) so React does not re-render every frame. */
  targetRef: MutableRefObject<HTMLElement | null>;
};

/**
 * Dev-only: samples frame deltas inside the R3F loop and writes stats to `targetRef`.
 */
export function LensPerfHud({ count, targetRef }: LensPerfHudProps) {
  const { gl } = useThree();
  const samples = useRef<number[]>([]);
  const last = useRef(performance.now());
  const flushAt = useRef(0);

  useFrame(() => {
    const now = performance.now();
    samples.current.push(now - last.current);
    if (samples.current.length > 120) samples.current.shift();
    last.current = now;

    const el = targetRef.current;
    if (!el || now < flushAt.current) return;

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

    el.textContent =
      `${fps.toFixed(0)} fps  ${mean.toFixed(1)} ms  p95 ${p95.toFixed(1)}  ` +
      `calls ${calls}  tris ${tris}  count ${count.toLocaleString()}  dpr ${dpr.toFixed(2)}`;
  });

  return null;
}
