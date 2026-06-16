/**
 * `NODE_ENV !== "production"` guards for optional debug output in consumers.
 * Safe when `process` is undefined (some edge runtimes); then dev helpers no-op.
 */
export function isMorphPhysicsDev(): boolean {
  try {
    return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export function morphPhysicsLog(...args: unknown[]): void {
  if (!isMorphPhysicsDev()) return;
  console.log("[@organic-llm/morph-physics]", ...args);
}

export function morphPhysicsWarn(...args: unknown[]): void {
  if (!isMorphPhysicsDev()) return;
  console.warn("[@organic-llm/morph-physics]", ...args);
}
