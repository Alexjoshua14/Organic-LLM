export const FIELD_JITTER_GLSL = `
float jitterHash(float n) {
  return fract(sin(n * 43758.5453) * 78.233);
}

vec3 fieldJitter(vec3 p, float id, float phaseTurbulence) {
  float ts = phaseTurbulence;
  float a = jitterHash(id * 19.19);
  float b = jitterHash(id * 53.13 + 1.7);
  float c = jitterHash(id * 91.71 + 5.3);
  // Per-particle directions; each axis evolves at its own slow rate so
  // particles drift incoherently rather than in lockstep.
  vec3 noise = vec3(
    sin(ts * (1.1 + a) + a * 31.0),
    sin(ts * (0.9 + b) + b * 47.0),
    sin(ts * (1.4 + c) + c * 23.0)
  );
  float amp = 0.18 + 0.22 * a;
  return noise * amp;
}
`;
