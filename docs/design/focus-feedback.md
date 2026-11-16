# Keyboard focus feedback

**Locked owner direction — 2026-11-11.** Organic uses Lumen, surface changes and text cues
for keyboard focus. Do not introduce surrounding focus rings as the default treatment.

Focus must stay unmistakable. Removing an outline without a visible replacement is not
an implementation of this rule. Keep keyboard navigation, focus restoration and native
control semantics intact.

## Shared default

`styles/FocusFeedback.css` provides `organic-focus` for an individual control and
`organic-focus-scope` for an owned group. The default combines a static Lumen wash with a
contrasting lower-edge cue. It preserves the control's background/text pairing, occupies no
layout space and adds no animation. The light appearance uses a deeper Lumen-family ink;
the dark appearance uses the canonical Lumen token from `styles/globals.css`.

Shared Button, Input, Textarea, Select trigger and dropdown items use this default.
Purpose-built controls may instead use an equally clear surface/text treatment, such as a
contrasting fill plus an underline. Focus must be distinguishable from hover and selection.
Menu arrow-key highlighting should remain visible as well as the selected-value marker.

In forced-colors mode, retain a system-color outline: system accessibility settings may
suppress gradients and shadows. This fallback is deliberate, not a decorative ring.

## Applying the rule

- Use the shared control or add `organic-focus`; do not add `focus-visible:ring-*` utilities.
- Use the scope class only for a component's owned controls, not as a global outline reset.
- Inspect light/dark themes and solid, destructive and glass button variants. Preserve text
  contrast; do not replace a primary button's background with a pale focus fill.
- Check Tab/Shift+Tab, menu arrows, Escape and focus return. Verify that the lower-edge cue
  is not clipped. Preserve the forced-colors fallback and reduced-motion behavior.
- When touching a legacy ring-based control, migrate it with a visible replacement. Explicit
  legacy overrides elsewhere still need auditing; do not claim a blanket application migration.
