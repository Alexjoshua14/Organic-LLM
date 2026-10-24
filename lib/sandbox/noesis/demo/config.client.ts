/**
 * CLIENT-SAFE mirror of the demo tuning knobs in `./config.ts`.
 *
 * Why this file exists (do not delete): `config.ts` is imported by the Noesis demo
 * **route handlers** (`demo-turn`/`npc-turn`/`demo-cache`), which call Clerk's `auth()`.
 * If a `"use client"` component ALSO imports `config.ts`, Turbopack groups those route
 * handlers into the React-SSR layer — whose Clerk copy is NOT wired to `clerkMiddleware()`
 * — so `auth()` throws "can't detect usage of clerkMiddleware()" and every demo request
 * 500s. (Confirmed root cause of the original "demo isn't working" bug.)
 *
 * To break that coupling, the client demo UI imports THESE constants instead of `config.ts`.
 * Keep the values in sync with `config.ts` — `tests/unit/noesis-sparks-and-demo.test.ts`
 * asserts they match so they can't silently drift.
 */

/** Default ultracheap demo model id. Mirror of `DEMO_DEFAULT_MODEL` in `./config.ts`. */
export const DEMO_DEFAULT_MODEL_ID = "google/gemini-3-flash";

/** Hard token ceiling per demo run. Mirror of `DEMO_TOKEN_BUDGET` in `./config.ts`. */
export const DEMO_TOKEN_BUDGET = 25_000;

/** Number of spark (assistant) replies per demo run. Mirror of `DEMO_REPLY_CYCLES`. */
export const DEMO_REPLY_CYCLES = 3;
