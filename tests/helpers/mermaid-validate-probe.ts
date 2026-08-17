/**
 * Runs `validateMermaidCode` in a bare runtime (no JSDOM preload) and prints the
 * outcome as JSON. Spawned by tests/unit/mermaid-validate.test.ts, which cannot
 * assert this in-process: the unit-test preload installs a global `window`,
 * which makes DOMPurify functional on its own and hides the very failure being
 * guarded against.
 */
import { MERMAID_VALIDATION_CANARIES, validateMermaidCode } from "@/lib/mermaid/validate";

const probe = {
  hasWindow: typeof (globalThis as { window?: unknown }).window !== "undefined",
  labeled: await validateMermaidCode(MERMAID_VALIDATION_CANARIES.labeled),
  broken: await validateMermaidCode(MERMAID_VALIDATION_CANARIES.broken),
};

console.log(JSON.stringify(probe));
