import type { FieldName, ModulatorName, StateRecipe } from "./fieldLibrary";
import type { MotionClockPhases } from "./motion-clocks";

import * as THREE from "three";

import { MAX_INHALE_PULL } from "../memory-ingest-tuning";

export type AnchorWorld = { x: number; y: number } | null;

function modulatorVec3(
  m: StateRecipe["modulators"],
  name: ModulatorName
): [number, number, number] {
  const v = m[name];

  if (v === undefined) return [0, 0, 0];
  if (Array.isArray(v)) return v;

  return [v, v, v];
}

function modulatorScalar(m: StateRecipe["modulators"], name: ModulatorName): number {
  const v = m[name];

  if (v === undefined) return 0;
  if (Array.isArray(v)) return v[0];

  return v;
}

/** Maps recipe + runtime into ShaderMaterial uniforms. Missing fields → 0. */
export function applyRecipeToUniforms(
  material: THREE.ShaderMaterial,
  recipe: StateRecipe,
  timeSeconds: number,
  anchor: AnchorWorld,
  opts: { intensity: number; pulseGlow: number; inhale?: number; phases?: MotionClockPhases }
): void {
  const u = material.uniforms;

  u.uTime!.value = timeSeconds;
  if (opts.phases) {
    u.uPhaseBase!.value = opts.phases.base;
    u.uPhaseTurbulence!.value = opts.phases.turbulence;
    u.uPhaseFlow!.value = opts.phases.flow;
    u.uPhaseShape!.value = opts.phases.shape;
  }

  u.uTempo!.value = modulatorScalar(recipe.modulators, "tempo");
  u.uCoherence!.value = modulatorScalar(recipe.modulators, "coherence");
  const energyBase = modulatorScalar(recipe.modulators, "energy");
  const intensity = Math.min(1, Math.max(0, opts.intensity));

  u.uEnergy!.value = energyBase * (0.55 + 0.55 * intensity);
  const an = modulatorVec3(recipe.modulators, "anisotropy");

  u.uAnisotropy!.value.set(an[0], an[1], an[2]);

  const f = recipe.fields;

  const get = (k: FieldName) => f[k] ?? 0;

  u.wBreath!.value = get("breath");
  u.wCurlNoise!.value = get("curlNoise");
  u.wRadialPulse!.value = get("radialPulse");
  u.wJitter!.value = get("jitter");
  u.wDirectionalDrift!.value = get("directionalDrift");
  u.wTendrilReach!.value = get("tendrilReach");
  u.wAbsorption!.value = get("absorption");
  u.wClusterAttract!.value = get("clusterAttract");
  u.wStreamlines!.value = get("streamlines");
  u.wLatticeSnap!.value = get("latticeSnap");

  u.wRoundedCube!.value = get("roundedCubeSDF");
  u.wSphere!.value = get("sphereSDF");
  u.wShellMask!.value = get("shellMask");
  u.wAxisElongation!.value = get("axisElongation");

  if (anchor) {
    const inhale = Math.min(1, Math.max(0, opts.inhale ?? 0));

    u.uAnchor!.value.set(anchor.x, anchor.y);
    u.uAnchorStrength!.value = inhale * MAX_INHALE_PULL;
  } else {
    u.uAnchor!.value.set(0, 0);
    u.uAnchorStrength!.value = 0;
  }

  u.uGlowPulse!.value = Math.min(1.2, opts.pulseGlow);
}

export function createLensParticleUniforms(): Record<string, THREE.IUniform> {
  const cloudRadius = 12;

  return {
    uTime: { value: 0 },
    uPhaseBase: { value: 0 },
    uPhaseTurbulence: { value: 0 },
    uPhaseFlow: { value: 0 },
    uPhaseShape: { value: 0 },
    uTempo: { value: 0.35 },
    uCoherence: { value: 0.5 },
    uEnergy: { value: 0.45 },
    uAnisotropy: { value: new THREE.Vector3(0, 0, 0) },

    wBreath: { value: 0 },
    wCurlNoise: { value: 0 },
    wRadialPulse: { value: 0 },
    wJitter: { value: 0 },
    wDirectionalDrift: { value: 0 },
    wTendrilReach: { value: 0 },
    wAbsorption: { value: 0 },
    wClusterAttract: { value: 0 },
    wStreamlines: { value: 0 },
    wLatticeSnap: { value: 0 },

    wRoundedCube: { value: 1 },
    wSphere: { value: 0 },
    wShellMask: { value: 0 },
    wAxisElongation: { value: 0 },

    uPointSize: { value: 14 },
    uFadeStart: { value: cloudRadius * 0.35 },
    uCloudRadius: { value: cloudRadius },

    uAnchor: { value: new THREE.Vector2(0, 0) },
    uAnchorStrength: { value: 0 },

    uParticleTint: { value: new THREE.Vector3(0.55, 0.55, 0.55) },
    uParticleAlpha: { value: 0.1 },
    uWarmth: { value: 0 },
    uGlowPulse: { value: 0 },
  };
}
