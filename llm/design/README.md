# @coalescence-labs/design

The Coalescence Labs design system, shared across our apps. It is developed inside Organic LLM
(`llm/design/`) and published to npm, so other apps install a pinned version and update when they
choose.

The first part is **Lumen**: how a surface shows depth.

| Theme | Lumen is | What it reads as |
| --- | --- | --- |
| Dark | Natural light | A warm rim of light coming up from behind and around the surface |
| Light | Shadow | A soft shadow, in the dark theme's background colour, that lifts the surface |

Every variant provides both. The full spec is
[`docs/design/lumen.md`](https://github.com/Alexjoshua14/Organic-LLM/blob/main/docs/design/lumen.md).

## Install

```bash
bun add @coalescence-labs/design
```

Requirements: class-based dark mode (an ancestor, usually `<html>`, carries `.dark`) and React 18
or 19 for the hooks.

## CSS

```css
@import "tailwindcss";
@import "@coalescence-labs/design/lumen.css";
/* Optional, Tailwind v4: text-lumen, bg-lumen-rim, border-lumen-deep, … */
@import "@coalescence-labs/design/tailwind.css";
```

Import after Tailwind so the package's `@layer components` rules join Tailwind's layer order.

### Variables

Every variable starts with `--cl-`.

| Variable | Default | Set it to |
| --- | --- | --- |
| `--cl-lumen-surface-dark` | `oklch(0.141 0.005 285.823)` | Your dark theme's background. The light-mode shadow is made from it. |
| `--cl-lumen-orb-size` | `2rem` | The orb's diameter. |
| `--cl-lumen-orb-color` | base Lumen | A colour for one orb, e.g. `kelvinToCss(2800)`. |

Read-only tokens: `--cl-lumen`, `--cl-lumen-rim`, `--cl-lumen-deep` (RGB channels, for
`rgb(var(--cl-lumen) / 0.2)`), their `-oklch` forms for solid fills, `--cl-lumen-shadow-rest`,
`--cl-lumen-shadow-hover`, `--cl-lumen-duration` and `--cl-lumen-ease`.

The rim hooks write `--cl-lumen-inset`, `-outset`, `-band`, `-blur`, `-bleed`,
`--cl-lumen-chip-radius` and `--cl-lumen-shell-radius` on the host element.

## Variants

| Variant | Markup | Use |
| --- | --- | --- |
| Chip rim | `.composer-tool-chip-host` › `.composer-tool-chip-stage` › `.lumen-rim-backlight` (+ `--on`, `--hover`, `--pulse`) and the button `.composer-tool-chip` (`-active` when engaged) | Buttons and toggles |
| Shell rim | `<LumenShell>` | A large surface such as a prompt input |
| Card rim | `.chat-style-card-host` › `.chat-style-card-stage` › `.chat-style-lumen-rim` + `.chat-style-card` | A selected card |
| Orb | `.lumen-orb` | Lumen on its own, such as a Kelvin swatch. Dark surfaces only. |
| Interactive | `.organic-lumen-interactive` | Shared buttons, selectors and menu rows |

The class names come from Organic LLM, where Lumen started. They are part of this package's API.

## React

```tsx
import { LumenShell, useLumenRim, useLumenRimHostRef } from "@coalescence-labs/design/lumen";

// Shell rim around a prompt input
<LumenShell surface="[data-prompt]">
  <div data-prompt className="rounded-xl">…</div>
</LumenShell>;

// Chip rim
function Chip({ on }: { on: boolean }) {
  const hostRef = useLumenRimHostRef();
  useLumenRim(hostRef, { target: ".composer-tool-chip" });

  return (
    <span ref={hostRef} className="composer-tool-chip-host relative inline-flex">
      <span className="composer-tool-chip-stage relative inline-flex">
        <span aria-hidden className={`lumen-rim-backlight ${on ? "lumen-rim-backlight--on" : "lumen-rim-backlight--hover"}`} />
        <button className={`composer-tool-chip relative z-10 ${on ? "composer-tool-chip-active" : ""}`}>…</button>
      </span>
    </span>
  );
}
```

Also exported: `lumenRimGeometry`, `LUMEN_RIM_RATIOS`, `kelvinToRgb`, `kelvinToCss` and the
Lumen Kelvin anchors (`LUMEN_KELVIN_DEEP` 2800K, `LUMEN_KELVIN_BASE` 3000K, `LUMEN_KELVIN_RIM`
3200K).

## Versioning

Semver. Renaming a variable or class, or changing how a variant looks, is a breaking change
(a minor bump while at 0.x, a major bump from 1.0).

## Releasing

Releases are published from GitHub Actions with npm trusted publishing: bump `version` here, then
push a tag `design-v<version>` (e.g. `design-v0.2.0`). See `.github/workflows/design-publish.yml`.

## License

Apache-2.0
