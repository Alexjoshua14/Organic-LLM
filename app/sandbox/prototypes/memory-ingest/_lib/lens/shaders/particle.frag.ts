export const PARTICLE_FRAGMENT_SHADER = `
/* precision comes from Three ShaderMaterial prefix */

uniform vec3 uParticleTint;
uniform float uParticleAlpha;
uniform float uWarmth;
uniform float uGlowPulse;

varying float vFog;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, d);
  a = pow(a, 1.6);
  vec3 base = uParticleTint;
  base.r += 0.12 * uWarmth;
  base.b -= 0.12 * uWarmth;
  base = clamp(base, 0.0, 1.0);
  float glowBoost = 1.0 + uGlowPulse * 0.45;
  gl_FragColor = vec4(base, a * vFog * uParticleAlpha * glowBoost);
}
`;
