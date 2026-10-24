/**
 * Stable public entry for layout constraint helpers (DTS-friendly subpath).
 * Re-exports from `./layoutRelaxation`; use `@organic-llm/morph-physics/layout-relaxation`
 * when the main bundled `index.d.ts` type re-exports are not resolved (e.g. some Next.js setups).
 */
export {
  suggestLayoutConstraintRelaxation,
  type LayoutConstraintRelaxation,
  type ShellLayoutInfo,
} from "./layoutRelaxation";
