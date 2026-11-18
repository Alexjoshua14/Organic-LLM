# Lumen

Lumen is how Organic shows depth around a surface. It means a different thing in each theme,
because light and dark surfaces tell depth differently.

| Theme     | Lumen is      | What it reads as                                                                                                |
| --------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| **Dark**  | Natural light | Warm light that comes up out of the dark, behind and around the surface                                         |
| **Light** | Shadow        | The absence of light: a soft shadow that lifts the surface off the page, the way a real object sits in daylight |

A warm glow on a light surface washes out and reads as a stain, so light mode does not use one.
A shadow is what a lit surface casts, so it keeps the same sense of depth and of light acting on
the object. Nothing in light mode is tinted warm.

**Related code**

- Rim, shadow and tokens: [`styles/globals.css`](../../styles/globals.css) (`--lumen*`, `--lumen-shadow-*`, `--background-dark`)
- Chip geometry and canonical spec: [`components/chat/use-composer-chip-lumen.ts`](../../components/chat/use-composer-chip-lumen.ts)
- Prompt shell: [`components/chat/home-composer-lumen-shell.tsx`](../../components/chat/home-composer-lumen-shell.tsx)
- Shared buttons, selectors and menu rows: `organic-lumen-interactive` in `styles/globals.css` (dark rim, light shadow; menu navigation uses neutral glass and a contained rim to avoid clipping).
- Chips and actions: [`components/chat/composer-action-button.tsx`](../../components/chat/composer-action-button.tsx)

## Dark: natural light

A blurred rounded-rect ring sits in a layer behind the surface (never on its fill) and lights it
from the edge. The band spans −3% to +10% of the surface's smaller side, with an 11% blur; the
chip host leaves room so the glow is not clipped.

| Surface                                  | Resting                   | Hover or focus         |
| ---------------------------------------- | ------------------------- | ---------------------- |
| Engaged chip (`lumen-rim-backlight--on`) | 0.36                      | 0.18                   |
| Inactive chip (`--hover`)                | 0                         | 0.18 peek              |
| Prompt shell (`home-composer-lumen-rim`) | 0.30, breathing 0.28–0.38 | 0.42, breathing paused |
| Memory halo (`core-input-memory-lumen`)  | 0.22, breathing 0.20–0.30 | 0.34                   |
| Selected chat-style card                 | 0.36                      | —                      |

The glass fill on a chip does not change on hover: no teal ghost background, no white flash.

## Light: shadow

Each rim is hidden and the surface itself carries a soft shadow in the **dark theme's background
colour** (`--background-dark`, the single source `.dark` also reads), so the shadow is the real
absence of that light, not a generic grey.

| Token                  | Value                   | Use                                                                      |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `--lumen-shadow-rest`  | `0 2px 8px -2px` at 14% | Engaged chips; the prompt shell at rest                                  |
| `--lumen-shadow-hover` | `0 2px 8px -2px` at 24% | Chip hover; prompt shell focused or hovered; memory halo; selected cards |

Shadows ease in over 200ms on chips and 320ms on the prompt shell, the same timings as the rim.
The shell's breathing is dark-only; the shadow is static. Reduced motion removes the transition.

A surface that shows a shadow only while focused (the editor lab's shell) keeps that rule: the
shadow is removed when focus leaves.

## Variants

Every Lumen surface is one of these. Use one before inventing another; add a new one here first.

| Variant         | Classes                                                                                       | Use                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chip rim**    | `composer-tool-chip-host` › `-stage` › `lumen-rim-backlight`                                  | Buttons and toggles: on (engaged) or a hover peek                                                                                                                                |
| **Shell rim**   | `HomeComposerLumenShell` (`home-composer-lumen-*`)                                            | The prompt shell; sized from its resting height so a growing composer keeps the same glow                                                                                        |
| **Card rim**    | `chat-style-card-host` › `-stage` › `chat-style-lumen-rim`, the card itself `chat-style-card` | A selected or chosen card (style cards, Launchpad starters, active task rows). The card's own edge is Lumen's too: warm in dark, neutral in light; never set it in the component |
| **Orb**         | `lumen-orb`, colour via `--lumen-orb-color`                                                   | Lumen shown on its own, such as Kelvin swatches; dark surfaces only                                                                                                              |
| **Panel focus** | `.core-input-options-panel:focus-visible`                                                     | A panel that takes focus: a faint glow in dark, the hover shadow in light, never a ring                                                                                          |

## Rules for a new lumen surface

1. Provide **both**: the dark rim and the light shadow, from the tokens above.
2. In light mode hide the rim and put the shadow on the surface's own stage, using its radius
   variable (`--composer-radius`, `--chip-radius`).
3. Do not tint the light shadow warm, and do not stack a rim and a shadow in one theme.
   That includes the surface's own border: a warm `--lumen-rim` border written into a component
   shows in light mode too. Put a lit edge in the variant's CSS, per theme.
4. Use `--lumen-shadow-*` and `--background-dark`; do not write a new shadow literal. If the
   depth you need does not fit these two steps, ask whether to change or add a token (see
   [Spacing](./spacing.md#when-a-request-does-not-fit-the-tokens)).

## Not covered here

- **Keyboard focus** is an ink and a wash, not a rim: see [Focus feedback](./focus-feedback.md).
  Its light appearance keeps a deeper Lumen-family ink.
- **The auto-model pill** carries its own light handling.
- **Admin index cards** still use a warm Lumen-tinted shadow in light mode. It predates this
  rule and should move to the shadow tokens.
