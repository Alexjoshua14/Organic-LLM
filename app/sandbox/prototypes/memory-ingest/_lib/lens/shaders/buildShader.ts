/** Concatenate GLSL chunks (noise, fields, shapes) before the main vertex body. */
export function buildShader(chunks: string[]): string {
  return chunks.join("\n\n");
}
