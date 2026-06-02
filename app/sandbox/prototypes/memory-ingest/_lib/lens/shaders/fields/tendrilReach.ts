/** Step 3 — tendril field (spec locked in plan). Motion clock channel: flow. */
export const FIELD_TENDRIL_REACH_GLSL = `
float tendrilHash(float n) {
  return fract(sin(n * 43758.5453) * 78.233);
}

/**
 * Sparse pulsed reach along anisotropy direction (or radial fallback).
 * Around 15% of particles participate to preserve body silhouette.
 */
vec3 fieldTendrilReach(vec3 p, float id, vec3 anisotropy, float phaseFlow) {
  float axisLen = length(anisotropy);
  vec3 dir = axisLen > 0.001 ? normalize(anisotropy) : normalize(p + vec3(0.0001));

  float mask = smoothstep(0.8, 0.95, tendrilHash(id * 31.19 + 0.17));
  float localPhase = tendrilHash(id * 1.7 + 5.3) * 6.2831853;
  float env = max(0.0, sin(phaseFlow * 0.5 + localPhase));
  float reachLength = 0.75;
  float reach = env * reachLength * mask;

  return dir * reach;
}
`;
