/** Lightweight value-noise and curl helper for flow-style displacement. */
export const NOISE_GLSL = `
float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  float n1 = valueNoise3(p + dy);
  float n2 = valueNoise3(p - dy);
  float n3 = valueNoise3(p + dz);
  float n4 = valueNoise3(p - dz);
  float x = (n1 - n2) - (n3 - n4);

  n1 = valueNoise3(p + dz);
  n2 = valueNoise3(p - dz);
  n3 = valueNoise3(p + dx);
  n4 = valueNoise3(p - dx);
  float y = (n1 - n2) - (n3 - n4);

  n1 = valueNoise3(p + dx);
  n2 = valueNoise3(p - dx);
  n3 = valueNoise3(p + dy);
  n4 = valueNoise3(p - dy);
  float z = (n1 - n2) - (n3 - n4);

  vec3 c = vec3(x, y, z);
  return normalize(c + vec3(0.0001));
}
`;
