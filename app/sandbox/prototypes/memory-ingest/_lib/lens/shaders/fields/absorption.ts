/** Step 3 — absorption field (spec locked in plan). Motion clock channel: flow. */
export const FIELD_ABSORPTION_GLSL = `
/**
 * Directional inward intake around an anisotropy axis with traveling swirl.
 * Falls back to camera-forward intake when anisotropy is near zero.
 */
vec3 fieldAbsorption(vec3 p, vec3 anisotropy, float phaseFlow) {
  float axisLen = length(anisotropy);
  vec3 axis = axisLen > 0.001 ? normalize(anisotropy) : vec3(0.0, 0.0, -1.0);
  float along = dot(p, axis);
  vec3 radial = p - along * axis;
  float radialLen = length(radial);
  vec3 radialDir = radialLen > 0.0001 ? radial / radialLen : vec3(0.0);

  float pull = 1.0 - exp(-0.8 * radialLen);
  vec3 inward = -radialDir * pull;

  float swirlWave = sin(phaseFlow + along * 0.45);
  vec3 tangential = cross(axis, radialDir) * (0.14 * swirlWave * pull);

  return inward + tangential;
}
`;
