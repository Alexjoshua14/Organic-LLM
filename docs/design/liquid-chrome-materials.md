# Liquid chrome materials

**Locked: 2026-10-13.** Light mode uses the approved paper-and-ink material. Dark mode
keeps the existing chrome field, blue-gray tint, amplitude, opacity, and interaction.

## Implementation contract

- Material values live in
  [`liquid-chrome-material.ts`](../../lib/background/liquid-chrome-material.ts).
  Use its paper color and amplitude in both background wrappers.
- The shared [`shader`](../../lib/background/liquid-chrome-shader.ts) owns the material
  math. `uPaperInk = 0` retains the original chrome output; `1` selects paper and ink.
  The third-party component defaults to chrome, so an unthemed consumer keeps its behavior.
- Paper grain stays in the background's CSS pixel coordinates. Its position does not
  depend on time or mouse interaction. Ink edges respond to the stationary paper surface;
  their small irregularities preserve the broad smooth gradient.
- The voice bar copies `uPaperInk` and `uPixelRatio` with the other live uniforms and
  samples the same field. Grain must align with the source background, including on
  Retina displays and while the background dims.
- Light mode rests at full opacity: its shader already bounds the pigment density for
  dark foreground text. Hover/focus dim intensities and transition timing are unchanged.
- `--liquid-chrome-fallback-light` supplies a pale paper gradient before WebGL loads and
  when reduced motion is enabled. Keep the dark fallback untouched.
- During hydration, retain the CSS fallback until the actual theme is known. A saved
  dark theme must never initialize a paper canvas while waiting for its client snapshot.

## Verification

When changing the shared shader, compare dark-mode pixels to the original chrome field
at several phases, mouse positions, and sampling tiers. Check light mode against its
approved material, then verify theme changes, reduced motion, and the voice-bar mirror.
