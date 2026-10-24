export const FIELD_BREATH_GLSL = `
vec3 fieldBreath(vec3 p, float id, float phaseBase) {
  float ts = phaseBase;
  float phase = id * 6.2831853;
  float sway = sin(ts * 1.7 + phase * 0.6);
  float lift = cos(ts * 1.3 + phase * 0.4);
  float depth = sin(ts * 1.1 + phase * 0.8);
  vec3 radial = normalize(p + vec3(0.0001));
  float amp = 0.45 + 0.18 * sin(id * 11.71);
  vec3 local = vec3(0.10 * lift, 0.14 * sway, 0.08 * depth);
  return radial * sway * amp + local;
}
`;
