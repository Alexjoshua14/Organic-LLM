import type { StateName, StateRecipe } from "./fieldLibrary";

/**
 * v1 recipe table. Every state drives `breath` + `jitter` in the vertex shader so
 * the FSM and dev dropdown show distinct motion; `roundedCubeSDF` keeps the rest
 * pose on the rounded-cube shell. Step-3 fields (`curlNoise`, `tendrilReach`,
 * `absorption`, …) land later as discrete GLSL chunks.
 *
 * **Inward tendrils (`searching_memory`):** `fieldTendrilReach` uses `normalize(uAnisotropy)`
 * when non-zero; the radial fallback is outward-only. For inward reach along camera Z,
 * set `modulators.anisotropy` to a non-zero vector pointing inward (e.g. `[0, 0, -1]`)
 * when wiring `tendrilReach` in step 3.
 */
export const RECIPES: Record<StateName, StateRecipe> = {
  idle_ready: {
    fields: {
      roundedCubeSDF: 0.85,
      breath: 0.4,
      curlNoise: 0.25,
      jitter: 0.05,
      sphereSDF: 0,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.32,
      coherence: 0.6,
      energy: 0.5,
      anisotropy: [0, 0, 0],
    },
  },
  listening: {
    fields: {
      roundedCubeSDF: 0.75,
      breath: 0.5,
      curlNoise: 0.4,
      jitter: 0.05,
      sphereSDF: 0,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.42,
      coherence: 0.55,
      energy: 0.5,
      anisotropy: [0, 0, 0],
    },
  },
  ingesting: {
    fields: {
      roundedCubeSDF: 0.6,
      breath: 0.3,
      curlNoise: 0.5,
      jitter: 0.1,
      absorption: 0.7,
      sphereSDF: 0,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.55,
      coherence: 0.5,
      energy: 0.62,
      anisotropy: [0, 0, 0],
    },
  },
  searching_memory: {
    fields: {
      roundedCubeSDF: 0.55,
      breath: 0.2,
      curlNoise: 0.5,
      jitter: 0.1,
      tendrilReach: 0.5,
      sphereSDF: 0,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.5,
      coherence: 0.4,
      energy: 0.6,
      anisotropy: [0, 0, 0],
    },
  },
  reasoning: {
    fields: {
      roundedCubeSDF: 0.4,
      breath: 0.3,
      curlNoise: 0.7,
      jitter: 0.05,
      sphereSDF: 0.5,
      clusterAttract: 0.4,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.22,
      coherence: 0.85,
      energy: 0.55,
      anisotropy: [0, 0, 0],
    },
  },
  web_search: {
    fields: {
      roundedCubeSDF: 0.4,
      breath: 0.15,
      curlNoise: 0.4,
      jitter: 0.05,
      tendrilReach: 0.7,
      sphereSDF: 0,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.7,
      coherence: 0.3,
      energy: 0.7,
      anisotropy: [0, 0, 0],
    },
  },
  writing_memory: {
    fields: {
      roundedCubeSDF: 0.9,
      breath: 0.6,
      curlNoise: 0.2,
      jitter: 0.03,
      sphereSDF: 0,
      shellMask: 0,
    },
    modulators: {
      tempo: 0.35,
      coherence: 0.75,
      energy: 0.78,
      anisotropy: [0, 0, 0],
    },
  },
};
