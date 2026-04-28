import { buildShader } from "./buildShader";
import { NOISE_GLSL } from "./noise";
import { FIELD_BREATH_GLSL } from "./fields/breath";
import { FIELD_JITTER_GLSL } from "./fields/jitter";
import { SHAPE_SPHERE_PROJECT_GLSL } from "./shapes/sphereProject";
import { SHAPE_SHELL_PROJECT_GLSL } from "./shapes/shellProject";

const PARTICLE_VERT_MAIN = `
/* Built-ins from Three prefix: precision, position, modelViewMatrix, projectionMatrix, … */

attribute float aId;

uniform float uTime;
uniform float uTempo;
uniform float uCoherence;
uniform float uEnergy;
uniform vec3 uAnisotropy;

uniform float wBreath;
uniform float wCurlNoise;
uniform float wRadialPulse;
uniform float wJitter;
uniform float wDirectionalDrift;
uniform float wTendrilReach;
uniform float wAbsorption;
uniform float wClusterAttract;
uniform float wStreamlines;
uniform float wLatticeSnap;

uniform float wRoundedCube;
uniform float wSphere;
uniform float wShellMask;
uniform float wAxisElongation;

uniform float uPointSize;
uniform float uFadeStart;
uniform float uCloudRadius;

uniform vec2 uAnchor;
uniform float uAnchorStrength;

varying float vFog;

void main() {
  vec3 aRest = position;

  vec3 disp = vec3(0.0);
  disp += wBreath * fieldBreath(aRest, aId, uTime, uTempo);
  disp += wJitter * fieldJitter(aRest, aId, uTime, uTempo);

  vec3 shaped = aRest;
  shaped = mix(shaped, sphereProject(shaped), wSphere);
  shaped = mix(shaped, shellProject(shaped), wShellMask);

  vec3 finalPos = shaped + uEnergy * disp;
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPointSize * (300.0 / max(-mvPosition.z, 0.01));
  vFog = 1.0 - smoothstep(uFadeStart, uCloudRadius, length(finalPos.xy));
}
`;

export const PARTICLE_VERTEX_SHADER = buildShader([
  NOISE_GLSL,
  FIELD_BREATH_GLSL,
  FIELD_JITTER_GLSL,
  SHAPE_SPHERE_PROJECT_GLSL,
  SHAPE_SHELL_PROJECT_GLSL,
  PARTICLE_VERT_MAIN,
]);
