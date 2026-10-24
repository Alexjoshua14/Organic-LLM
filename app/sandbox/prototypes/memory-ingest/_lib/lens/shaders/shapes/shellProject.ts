export const SHAPE_SHELL_PROJECT_GLSL = `
vec3 shellProject(vec3 p) {
  float r = length(p) + 0.001;
  return normalize(p) * (r * 0.92);
}
`;
