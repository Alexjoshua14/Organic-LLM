/** Smoothstep-style cubic ease for transition lerps. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));

  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
