---
name: transpile
description: Rebuilds the current @coalescence-labs/design system (Lumen today) natively in another technology (SwiftUI, a Rust TUI, Blender, Godot, Flutter, Unity, a canvas or WebGL renderer, another CSS stack) and integrates it into the user's project, keeping Lumen's intent, numbers, states and rules while using the target's own idioms. Pulls the latest Lumen through the survey skill instead of a remembered copy, and records provenance so the port can be updated when Lumen changes. Use when asked to "transpile Lumen", port, rebuild or bring Lumen (or the Coalescence Labs design system) to a platform, or to update an existing port.
---

# transpile

Rebuild a `@coalescence-labs/design` system in a **target technology** so it feels native there and
matches Lumen's design exactly where the target allows, and *deliberately* where it does not.

This skill holds the method, not the design. It never contains Lumen's values. Get them fresh from
**[survey](../survey/SKILL.md)** every time.

## 0. Inputs (ask only for what you cannot find)

- **Target:** platform, language, framework and renderer (e.g. "SwiftUI on macOS", "Rust +
  ratatui in a truecolor terminal", "Blender 4.x, Eevee, Python add-on").
- **Project:** the user's repo or file the port goes into. Read its conventions before writing.
- **System:** default `lumen`. **Version:** default latest.
- **Existing port:** look for `.coalescence/port.json` in the project. If present, this is an
  update (step 7).

## 1. Get the current model

Run **survey** for the system and version. You need its full model: intent, tokens, geometry,
variants and states per theme, motion, accessibility, rules, platform assumptions. Do not proceed
from memory, from a previous conversation, or from this file.

## 2. Separate essence from mechanism

From the model, write two short lists before any code:

- **Essence** (must survive any port): what the effect means in each theme; the ratios and
  formulas; per-state intensities; timings and easing shapes; which states exist; that both themes
  are always provided; reduced-motion behaviour; the rules and invariants.
- **Mechanism** (how the web draws it): CSS blur on a bordered layer, `color-mix`, cascade layers,
  `:has()`, a resize observer, class-based dark mode. These are replaceable.

Everything after this step preserves the essence and re-implements the mechanism.

## 3. Map each platform assumption

For every assumption in the model's "Platform assumptions", choose the target's equivalent and
grade it:

| Grade | Meaning |
| --- | --- |
| **Exact** | Same visual result and numbers (e.g. a native Gaussian blur behind the view). |
| **Equivalent** | Different technique, same perceived result (e.g. an emissive ring plus bloom in a 3D renderer). |
| **Approximated** | The target cannot express it; the closest faithful rendering, with the loss stated (e.g. a terminal has no blur, so the rim becomes graded colour cells around the box). |
| **Omitted** | Impossible or harmful on the target; say why. |

Rules for mapping:

- Map **meaning before pixels**. In a dark theme the effect is light from *behind* the surface;
  in a light theme it is a *shadow* in the dark surface's colour. Keep that even when the drawing
  technique changes completely.
- Keep the **numbers as ratios** where the target's units differ (points, cells, Blender units):
  derive sizes from the model's formulas against the target's measured surface; do not copy pixel
  values into a unit system they do not belong to.
- Convert colours through a stated colour space, and keep the model's original value beside the
  converted one.
- Theme detection, hover, focus and reduced motion use the target's native signals (system
  appearance, accessibility settings, focus systems). If a signal does not exist (a terminal has
  no hover), map the state to the closest native one or omit it and say so.
- Animation uses the target's animation system with the model's durations and easing curves.

## 4. Fit the target project

Before writing, read the project's structure, naming, theming and token conventions. Then:

- Put tokens where that project keeps design constants (a theme struct, an asset catalog, a
  constants module, a shader node group), named after the model's tokens.
- Build one **rim primitive** that implements the geometry and states once, and express each
  variant through it, as the source does.
- Match the project's file layout, naming and comment density. Add no dependency without the
  user's approval.

## 5. Write provenance

Create or update `.coalescence/port.json` in the project:

```json
{
  "system": "lumen",
  "package": "@coalescence-labs/design",
  "version": "<version the model was built from>",
  "model": ".coalescence/lumen-model-v<version>.md",
  "target": "<platform, language, renderer>",
  "mappings": [{ "assumption": "<from the model>", "grade": "exact|equivalent|approximated|omitted", "how": "<one line>", "files": ["<path>"] }]
}
```

Put a one-line header in each generated file naming the system, version and model it came from.

## 6. Verify

- **Parity table:** for every token, formula, state and timing in the model, show the model value
  (with its citation), the ported value and the grade. No row may be missing.
- **Both themes** and **reduced motion** exercised, by running the target if you can (tests,
  previews, a render, a screenshot) or by stating clearly that you could not.
- **Rules:** check each rule from the model against the port and say how it holds.
- Report Approximated and Omitted rows to the user plainly. Never present an approximation as
  exact.

## 7. Updating an existing port

1. Read `.coalescence/port.json` and its model.
2. Run **survey** for the newer version with the old model as the previous model. Its "Changes
   since" section is the work list.
3. Apply only those changes through the existing mappings. Re-grade any mapping a change touches.
4. Update `port.json`, the file headers and the parity table. Tell the user what changed visually.

## What not to do

- Do not snapshot Lumen into this skill, the project's docs, or your memory. The model file is
  versioned and replaceable; that is the only copy.
- Do not "improve" the design while porting (new colours, extra glow, different timings). Port it;
  propose changes separately.
- Do not reproduce the web's mechanism where it is unnatural on the target (no fake CSS engine in a
  game engine); the essence is what must match.
