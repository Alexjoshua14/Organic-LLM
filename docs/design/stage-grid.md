# Stage grid

Stage draws the grid with two static CSS background layers: one for vertical lines and
one for horizontal lines. Each reveals along the line direction from the top-left;
cell spacing stays fixed throughout. This adapts the Stratum book-outline drawing
reference without SVG stroke animation, masks, color changes, or per-line elements.

The approved timings are 220ms on entry and 140ms on exit, with no delay. Constants live
beside the effect in `components/stage/stage.css` (`--stage-grid-enter`,
`--stage-grid-exit`). Keep future adjustments in the 180–240ms entrance and 100–160ms
exit ranges. The existing grid color and opacity remain unchanged.

Only transform and opacity transition. No animation loop, timers, persistent
`will-change`, layout interpolation, blur, or application state waits on motion.
Toggling or selecting a widget responds immediately; reversing mid-transition is handled
by CSS. At rest there is no ongoing animation. Reduced motion disables the transition.

A Chromium trace of the isolated grid toggle recorded zero layout events and zero
JavaScript animation-frame callbacks. Paints occurred at transition boundaries, not
throughout the transition. This verifies the mechanism in that fixture, not every
browser/GPU combination.

## Viewport ownership

Stage is one 32×32 top-level grid. Navigation, Organic and its active children,
artifacts, the latest response, and CoreInput each own cells. Canonical reservations
live in `lib/stage/schema.ts`; both designer context and server validation include
the response and composer. Generated pieces stay in the artifact area. Prior
snapshots are repaired without discarding content.

`lib/stage/frame.ts` fits those responsibilities to the available viewport. A
ResizeObserver measures the root and natural composer height; it does no work on
idle frames. Authored arrangements remain when readable. Otherwise Stage shows
one or two useful pieces at reading size, with explicit selection/paging. Growing
CoreInput reallocates cells. Selecting a response can give it the main reading
area; short viewports offer this action instead of a one-line scrolling preview.
The outer grid has no forced minimum width/height or scrolling canvas. Native
scrolling remains available inside genuinely long content.

Diagrams use the shared Mermaid renderer's `canvas` variant: no well, border,
padding, type label, or repeated title. Recipes own their single heading. Piece
arrangement controls appear on hover/focus and stay available on touch. Agent
identity uses OrganicActivityMark with a Stage-local, more legible glass profile;
names/status are secondary and reserve caption metrics.

## Placement preview

Valid geometry edits preview after 150ms of inactivity. The existing layout
validator rejects collisions; invalid edits retain the last valid preview. Closing
restores saved geometry, and Place it persists the edit. Position changes use a
140ms transform transition (instant under reduced motion). Memoized piece content
keeps geometry edits from regenerating Markdown or Mermaid. Source/title edits
remain explicit saves.
