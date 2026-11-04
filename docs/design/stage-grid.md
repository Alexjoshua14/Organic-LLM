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

`lib/stage/frame.ts` sizes one set of 32 CSS grid tracks from the available
viewport and the composer's measured natural height. Header, response and composer
keep their owned rows; artifact rows use the remaining space. Track heights may
differ, and the guide backgrounds draw those exact boundaries. Resizing changes
pixels per cell, never a piece's row, column, width or height.

Every widget renders the saved rectangle for its tab: `rect` owns All pieces,
`layouts.author` owns its source author's tab, and `layouts.piece` owns its own
focused tab. One selector resolves these placements for the renderer, inspector,
validator and agent context. Pieces in different tabs can reuse the same cells;
only visible siblings compete for artifact space. There is no render-time
coordinate projection, readability reflow or pagination. Grid only reveals guides.
Inspecting, saving and closing use the same active-tab geometry, and switching away
and back restores that tab's exact saved cells.

Publication/recovery initializes missing focused and author placements as real
saved data. A single piece gets the full artifact area; siblings share a balanced
arrangement. Existing valid arrangements are stable; a changed membership or invalid
legacy layout is repaired before publication. Recovery also redistributes old
miniature overview pieces once. Full worker results aren't recovered as duplicate
notes when attributed pieces already exist.

Piece navigation lives with the response controls, so it consumes no artifact
cells. In specialist and individual-piece tabs, the response contracts to its controls and gives
the artifact rows more height. The full reply remains available through the
explicit response expansion or Conversation. Long content retains native scrolling
inside its explicitly sized piece. To change reading space, save a validated
placement in the intended tab; do not override it in the renderer.

Organic's centered home and an explicitly expanded response hide pieces without
changing their rectangles. Visited pieces stay mounted while hidden. The server
validator, designer context and rendered workspace use the same chrome/agent
reservations. Model context includes row heights and actual pixel bounds so it
can judge the space available for a requested layout.

Diagrams use the shared Mermaid renderer's `canvas` variant: no well, border,
padding, type label, or repeated title. Recipes own their single heading. Piece
arrangement controls appear on hover/focus and stay available on touch. Agent
identity uses OrganicActivityMark with a Stage-local, more legible glass profile;
names/status are secondary and reserve caption metrics.
The child cancellation control reads **Stop**, separate from the identity button
that opens its work. Its tooltip and accessible label name the affected child.

## Placement preview

Valid geometry edits preview after 150ms of inactivity. The existing layout
validator rejects collisions; invalid edits retain the last valid preview. Closing
restores saved geometry, and Place it persists the edit for the active tab. The
inspector names that tab; changes preserve other tabs' placements. Position changes use a
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
