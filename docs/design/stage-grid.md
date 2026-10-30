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

## View selection

Organic is the centered home view. It tucks pieces away, while specialist views
show that author's work and Pieces exposes the workspace. The response and
composer share the page center; reader actions sit at the trailing edge. Visited
pieces stay mounted while tucked away, preserving diagram SVGs, chat and scroll
state. They render lazily on their first visit.

`lib/stage/views.ts` supplies the same owner-scoped view catalog to UI, Organic,
workers and voice. Whole, unambiguous navigation requests switch existing views
before generation/budget/lease work. They do not append transcript messages or
start jobs. Organic can also return a validated view action for requests that need
interpretation. Current selection, measured viewport and visible cells accompany
typed requests and live voice screen context; worker context includes the last
reported presentation. View commands have IDs and apply once, including voice's
immediate client effect, so later polling does not undo a manual choice. Workers
publish work without changing selection.

Stage's CoreInput row removes the base textarea's vertical margins and centers
its controls. Its submit affordance is a quiet circular arrow with a disabled
state and busy indicator; the prototype glass/idle glyph remains scoped to other
opt-in uses. These adjustments are specific to Stage beta.
