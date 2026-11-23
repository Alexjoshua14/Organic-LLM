---
name: survey
description: Builds an accurate, current model of a @coalescence-labs/design system (Lumen today) by reading its published source, never a remembered or cached copy. Produces a versioned, cited model of tokens, variants, geometry, motion, theming, accessibility and rules that another skill or agent can rebuild from. Use before porting, auditing or explaining the design system, when the transpile skill asks for a model, or when asked "what is Lumen", "what changed in Lumen", or to refresh a port.
---

# survey

Build a model of one system in `@coalescence-labs/design` from its source of truth. The model is
what `transpile` (and any other consumer) rebuilds from, so it must be **current, complete,
cited and free of invention**.

This skill describes *how to read*. It deliberately contains no Lumen values: every number,
name and rule in your model must come from the files you read in this run.

## 0. Inputs

- **System:** the part of the package to model (today: `lumen`). Default `lumen`.
- **Version:** `latest` unless the user or a provenance file pins one.
- **Previous model** (optional): a model file from an earlier survey, to diff against.

## 1. Locate the source of truth

Use the first that applies, and record which one you used:

1. **Installed package:** `node_modules/@coalescence-labs/design/` in the target project. Read its
   `package.json` `version`. If the user asked for `latest`, compare with
   `npm view @coalescence-labs/design version` and prefer the newer source.
2. **Fetched package:** in a new empty directory outside the target project,
   `npm pack @coalescence-labs/design@<version>` then `tar -xzf` the tarball. Read files; never
   run scripts from it.
3. **No npm:** fetch individual files from `https://unpkg.com/@coalescence-labs/design@<version>/<path>`.

The spec (design intent and rules) lives in the source repository, pinned to the release tag:
`https://raw.githubusercontent.com/Alexjoshua14/Organic-LLM/design-v<version>/docs/design/lumen.md`.
If that tag does not exist yet, use `main` and say so in the model.

## 2. Read in this order, and only these files

The package's `package.json` is the map. Its `exports` name every public entry; `files` names what
ships. Read:

1. `package.json`: `version`, `exports`, `peerDependencies`.
2. `README.md`: inputs, variants table, versioning rules.
3. The spec (`lumen.md` above): intent per theme, intensity tables, rules for new surfaces.
4. Each CSS export (e.g. `css/lumen.css`, `css/tailwind.css`), top to bottom.
5. TypeScript **source** under `src/<system>/` (shipped alongside `dist/`). Read `index.ts` first
   for the public surface, then each module it re-exports. Do not read `dist/` unless `src/` is
   missing; it is generated.

Skip tests, CI files, lockfiles and anything not reachable from `exports`. The system is small; read
whole files rather than grepping, so nothing between matches is missed.

## 3. Extract the model

Write the model with these sections, in this order. Every value carries a citation
`path:line` into the version you read.

1. **Header:** system, package version, source used (installed, packed, unpkg), spec ref (tag or
   `main`), date.
2. **Intent:** one paragraph per theme, in the spec's own terms (what the effect *is*, not how CSS
   draws it).
3. **Tokens:** a table of name, value exactly as written, unit or colour space, role, and whether
   an app may set it (input) or should only read it.
4. **Geometry and logic:** every formula (ratios, derived sizes, what is measured, when it is
   measured, what stays fixed while a surface grows), as math, not code.
5. **Variants:** for each variant, the layer structure (what sits behind what), each state
   (rest, hover, focus, active, engaged, disabled) and its values *per theme*.
6. **Motion:** durations, easings, keyframes (name, stops, values), what animates, what pauses
   it.
7. **Accessibility:** reduced-motion behaviour, focus handling, anything hidden from assistive
   technology.
8. **Rules and invariants:** the spec's "do"/"do not" rules, plus structural invariants you can
   see in the source (for example, a rim is never drawn on the surface's own fill).
9. **Platform assumptions:** what the source relies on that another platform may lack (blur
   filters, layered compositing, colour-mix, cascade layers, a resize observer, class-based dark
   mode). Name each assumption; `transpile` maps them.
10. **Open questions:** anything the source and spec disagree on, or leave undefined.

## 4. Verify before handing over

- **Coverage:** count the custom properties declared in each CSS export, the keyframes, the
  exported symbols in `index.ts`, and the rows in the spec's variant table. Each count must match
  the model. If not, find what you missed.
- **No invention:** every value in the model has a citation. Delete or move to Open questions
  anything you cannot cite.
- **Exactness:** copy values character for character (colour functions, easing curves, units).
  Do not round, convert or "simplify".
- **Disagreements:** where the spec and source differ, the **source** is what ships. Record both
  under Open questions.

## 5. Save and diff

Save the model where the caller asks; by default `.coalescence/<system>-model-v<version>.md` in the
target project. If a previous model exists, add a **Changes since v<old>** section at the top:
tokens added, removed or changed (old → new), variants or states changed, formula changes, rule
changes. That section is what an update applies.

## Token budget

Read each file once, whole. Write the model once. Do not paste source into the model; cite it. A
complete Lumen model should be a few hundred lines at most.
