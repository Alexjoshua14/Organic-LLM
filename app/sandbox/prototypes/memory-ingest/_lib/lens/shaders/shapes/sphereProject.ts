export const SHAPE_SPHERE_PROJECT_GLSL = `
vec3 sphereProject(vec3 p) {
  return normalize(p + vec3(0.001)) * 4.2;
}
`;
