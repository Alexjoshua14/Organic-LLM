import { mock } from "bun:test";

/**
 * Registers a module mock whose overrides sit on top of the real module's exports, and
 * returns a function that puts the real module back.
 *
 * Bun applies `mock.module` to the whole test process and never reverts it, so a stub
 * registered in one file is still installed when every later file loads. Test file order
 * differs between macOS and the Linux CI runner, so the damage only shows up in CI. It has
 * broken CI twice: a partial stub dropped exports the next file imported, and a behavioural
 * stub leaked into the mocked module's own test.
 *
 * Merging over the real module fixes the first failure mode. For the second, call the returned
 * restore function from `afterAll` — but only when no other file registers its own stub for
 * that module at load time. Modules stubbed by several files (TTS context, user settings) rely
 * on last-writer-wins, and restoring mid-run breaks whichever file expected its own stub.
 *
 * Pass the real module as a namespace import, which is evaluated before this call runs:
 *
 * ```ts
 * import * as syncWorker from "@/lib/spatial-artifacts/sync/sync-worker";
 *
 * const restore = mockModulePreservingReal(
 *   "@/lib/spatial-artifacts/sync/sync-worker",
 *   syncWorker,
 *   { enqueueArtifactSync: mockEnqueueArtifactSync }
 * );
 *
 * afterAll(restore);
 * ```
 */
export function mockModulePreservingReal<T extends object>(
  specifier: string,
  real: T,
  overrides: Partial<T> | ((real: T) => Partial<T>)
): () => void {
  // Snapshot now: `real` is a live namespace whose bindings a later mock would overwrite.
  const snapshot = { ...real };
  const applied = typeof overrides === "function" ? overrides(snapshot) : overrides;

  mock.module(specifier, () => ({ ...snapshot, ...applied }));

  return () => mock.module(specifier, () => ({ ...snapshot }));
}
