"use client";

import type { MutableRefObject } from "react";
import type { StateName } from "../../_lib/lens/fieldLibrary";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { buildRoundedCubeRest } from "../../_lib/lens/geometry";
import {
  applyRecipeToUniforms,
  createLensParticleUniforms,
  type AnchorWorld,
} from "../../_lib/lens/uniforms";
import { PARTICLE_FRAGMENT_SHADER } from "../../_lib/lens/shaders/particle.frag";
import { PARTICLE_VERTEX_SHADER } from "../../_lib/lens/shaders/particle.vert";
import { useStateManager } from "../../_lib/use-state-manager";
import {
  PARTICLE_ALPHA_FROM_TOKEN,
  readForegroundProbeRgb01,
} from "../../_lib/theme-particle-colors";

function warmthForState(s: StateName): number {
  switch (s) {
    case "searching_memory":
      return 0.75;
    case "web_search":
      return -0.85;
    case "writing_memory":
      return 0.35;
    default:
      return 0;
  }
}

export type LensPointsProps = {
  state: StateName;
  intensity: number;
  count: number;
  pointSize: number;
  themeProbeRef: MutableRefObject<HTMLElement | null>;
  pulseGlowRef: MutableRefObject<number>;
  anchorWorldRef: MutableRefObject<AnchorWorld>;
};

export function LensPoints({
  state,
  intensity,
  count,
  pointSize,
  themeProbeRef,
  pulseGlowRef,
  anchorWorldRef,
}: LensPointsProps) {
  const mgr = useStateManager(state);
  const { clock } = useThree();

  const geometry = useMemo(() => {
    const { positions, ids } = buildRoundedCubeRest(count);
    const geom = new THREE.BufferGeometry();

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("aId", new THREE.BufferAttribute(ids, 1));

    return geom;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: createLensParticleUniforms(),
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useEffect(() => {
    // Larger sprites (+50% from previous tuning) while keeping particle separation legible.
    material.uniforms.uPointSize!.value = pointSize * 30;
  }, [material, pointSize]);

  const points = useMemo(() => new THREE.Points(geometry, material), [geometry, material]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame(() => {
    const recipe = mgr.current.update(performance.now());

    applyRecipeToUniforms(material, recipe, clock.elapsedTime, anchorWorldRef.current, {
      intensity,
      pulseGlow: pulseGlowRef.current,
    });

    material.uniforms.uWarmth!.value = warmthForState(state);

    const probe = themeProbeRef.current;

    if (probe) {
      const parsed = readForegroundProbeRgb01(probe);

      material.uniforms.uParticleTint!.value.set(parsed.r, parsed.g, parsed.b);
      material.uniforms.uParticleAlpha!.value =
        Math.min(1, parsed.alpha) * PARTICLE_ALPHA_FROM_TOKEN;
    }
  });

  /* R3F `primitive` maps to arbitrary THREE objects; eslint-plugin-react does not know these props. */
  /* eslint-disable react/no-unknown-property */
  const node = <primitive dispose={null} object={points} />;
  /* eslint-enable react/no-unknown-property */

  return node;
}
