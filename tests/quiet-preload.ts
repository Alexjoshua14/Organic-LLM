/**
 * Runs after tests/preload.ts. Silences console output from the code under test so a passing
 * run prints a few lines instead of hundreds (logger traces, React error-boundary dumps, jsdom
 * "Not implemented" warnings). Failures are unaffected: Bun prints the assertion diff, source
 * frame, and stack itself, not through `console`.
 *
 * Set `TEST_VERBOSE=1` to get the console output back, e.g. `TEST_VERBOSE=1 bun run test:unit`.
 * Do that when a failure shows no cause — a route test that fails as "expected 200, got 500"
 * often has the real error only in a `console.error`.
 */
const verbose = process.env.TEST_VERBOSE === "1" || process.env.TEST_VERBOSE === "true";

if (!verbose) {
  const silent = () => {};

  for (const method of ["log", "info", "debug", "warn", "error", "trace", "dir", "table"] as const) {
    console[method] = silent;
  }
}
