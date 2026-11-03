# Subagent card lab

`/sandbox/subagents/cards` (Subagent lab → Subagent cards) is where the multiagent view's subagent
card is refined. It shows **Current** and **Next** side by side, each as a desktop card and a
mobile card, driven by shared controls (state selector, auto cycle, Selected, Call active).

## Which file is which

| Version | Card | Swipe row |
|---------|------|-----------|
| **Current** (what ships in the multiagent view) | `app/sandbox/arcadia/_components/subagent-card.tsx` | `app/sandbox/arcadia/_components/subagent-swipe-row.tsx` |
| **Next** (the working fork) | `app/sandbox/subagents/cards/_components/next-subagent-card.tsx` | `app/sandbox/subagents/cards/_components/next-subagent-swipe-row.tsx` |

The lab itself is `subagent-card-lab.tsx` in the same `_components` folder. Its Current column
imports the live component; its Next column imports the `Next*` fork.

## Rules

- **Design changes go to Next only.** When asked to change how the card looks or behaves ("make the
  name lighter", "dim the waveform"), edit the `next-*` files. Do not touch the live components,
  and do not apply the same edit to both. The point of the lab is that Current stays a baseline.
- **Mirror to the swipe row only when asked.** Mobile in the multiagent view uses the full card at
  roughly 90vw with side gutters, not the swipe row. The swipe row is the condensed variant.
- **Shared pieces need care.** `subagent-speak-glass-bar.tsx` and `components/voice/*` serve both
  versions. If Next needs different behaviour there, add an opt-in prop (see `fillHeight`) so
  Current is unchanged until promotion. Genuine bug fixes in shared code may land for both; say so.
- **Never delete or reshape Next or the lab** unless told to. Keep the two-column layout.
- Use the spacing token system ([spacing](./spacing.md)), not raw pixel values, for page layout.
- Leave work uncommitted unless asked.

## "Promote"

Promote means copy Next into Current. Next stays in place, now identical to Current, ready for the
next round.

1. Copy `next-subagent-card.tsx` over `subagent-card.tsx`. Rename `NextSubagentCard` to
   `SubagentCard`, and change the speak-bar import from
   `@/app/sandbox/arcadia/_components/subagent-speak-glass-bar` to `./subagent-speak-glass-bar`.
2. Do the same for the swipe row (`NextSubagentSwipeRow` to `SubagentSwipeRow`). Diff first: if
   Next's swipe row is identical, nothing changes.
3. Carry over opt-in behaviour in shared files if Next relied on it. The card already passes
   `fillHeight`, so the speak bar needs no further change.
4. Update tests that assert on the old markup (for example `tests/unit/arcadia-mobile-controls`
   looks up the card's select button by name).
5. Do not delete the `next-*` files, the lab, or its test.
6. `bunx eslint --fix` the touched files, then `bunx tsc --noEmit` and `bun run test:unit`.

## Gotchas

- The lab scales samples with a CSS `scale` transform to fit narrow windows. Anything that
  measures its own box with `getBoundingClientRect` reads the scaled size. The 3D glass canvas
  therefore measures `offsetSize` (`CANVAS_RESIZE` in `voice-fluid-glass-canvas.tsx`). Keep that if
  you touch the canvas.
- Speak sits inside the card, over a full-card link overlay. The Speak control must not pass its
  click through to the card. Text is `select-none` and the card and Speak use `cursor-pointer`.
- The Organic Agent mark is the body of the card. Do not resize it unprompted.
