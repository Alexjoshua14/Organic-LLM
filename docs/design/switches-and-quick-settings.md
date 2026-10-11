# Switches and quick settings

Use `Switch` from `components/design-system/switch.tsx` for new switches. It keeps
HeroUI's `isSelected`, `onValueChange`, disabled, form, and input-ref APIs, with
Organic's glass styling applied by default. The existing Radix entry point at
`components/third-party/ui/switch.tsx` shares the same material and dimensions;
its `checked` / `onCheckedChange` API stays intact.

The visual track is 36 × 20px, with a 14px thumb. Both use the existing neutral
smoke `glass()` primitive. The unchecked track retains the default neutral color;
checked tracks retain their semantic color at 80% opacity, with a near-white
thumb. HeroUI color variants and slot overrides remain available. Motion uses
the underlying switch transitions and stops under reduced motion.

Visual size and pointer targets are separate: the HeroUI wrapper reserves at
least 44 × 44px. The Radix control extends its pointer target to 44 × 44px with a
pseudo-element, without increasing its layout size in existing compact toolbars.

Quick settings uses one label-and-control row per option, with 8px between rows.
Descriptions live in `QuickSettingRow` popovers instead of taking space below
each label. Hovering or focusing the feature's text shows its caption; tapping
or clicking pins it until another tap, outside interaction, or Escape. Opening
a caption never changes the setting. Popovers are portaled above the sheet,
constrained to available viewport width, and do not change row layout or steal
focus. The sheet initially focuses its own container so no caption opens merely
because the panel was opened.

`CAPTION_CLOSE_GRACE_MS` lives beside the interaction in
`components/settings/quick-setting-row.tsx`. Its 120ms grace allows the pointer
to cross the 4px gap into the caption; entering the caption cancels the pending
close. Keep this grace brief (100–150ms), with no entrance delay or animation.
This supports the [W3C hover/focus requirements](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
for dismissible, hoverable, persistent content. Popover positioning and dismissal
use the existing [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover).

The quick-settings sheet uses `glass({ opaque: true, border: "left" })`; captions
also use opaque glass for readable text. Both inherit the primitive's existing
fallbacks for reduced transparency and environments without backdrop filtering.
