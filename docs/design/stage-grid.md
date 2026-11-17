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

## Piece arrival

A piece fades up (opacity and a 6px translate) when it mounts or comes out of hiding, over
the grid's entrance time (`--stage-grid-enter`, 220ms). That covers a designer result, a
tab change and a demo scene switch, so arrangements settle in instead of popping. Pieces
that leave the view are tucked away with `hidden` and have no exit animation yet; an exit
would need `transition-behavior: allow-discrete` or a retained-element pass, and should be
faster than the entrance (100–160ms). Reduced motion disables the arrival.

A framed web page keeps its heading and surface from the first paint and fades the page in
over them (`--stage-enter`, 220ms) when it loads. Slow third-party resources can hold a
page's load event for seconds, so it is shown after 1.2s regardless (`WEB_REVEAL_MS` in
`components/stage/stage-web.tsx`). The page is laid out at least 920px wide and scaled to
its cell (never below 0.7), so it keeps a desktop layout at the stage's reading size
instead of collapsing to a phone layout in a narrow cell.

## One topic, four pieces

The stage shows one topic at a time, in at most four pieces (`STAGE_MAX_PIECES` in
`lib/stage/reconcile.ts`); more and each piece is too small to read. The designer marks a
plan `fresh` when the brief moves to a new topic, and every piece it doesn't touch is cleared
in one step. Otherwise, the oldest untouched pieces give way only as far as the cap needs.
Collections and Recall are never removed this way. Whenever pieces leave, or a new piece
finds no room, the stage is re-tiled evenly: one piece takes the artifact area, two take
halves, three or four a 2×2. Specialist results follow the same rule. Reading a stage never
removes anything.

**New stage**, in the top bar, clears pieces, conversation and queued work after a second
press within 4s. A running designer or specialist sees its job gone and stops. Memories and
the Activity history stay.

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

The latest response owns rows only on Organic's home view and while reading. In every
view that shows pieces its rows are sized to zero and the artifact rows take the height,
so the composer is the only thing under the pieces. Its cells stay reserved: the designer
and the validator still keep pieces out of them. The full exchange stays in Conversation.
The top bar shows two buttons: Tools and Conversation. Tools opens a tray in place with
Context, New stage, Pieces, Grid and Activity; while it is closed, a small dot on Tools says
the grid or added context is on. The tray hides rather than unmounts, so added context
survives closing it. Opening it, each tool fades and slides 8px out from the Tools button,
nearest first, over `--stage-enter` (220ms) with a 20ms stagger (`--stage-tray-stagger`);
closing fades them back together over `--stage-feedback` (140ms) with no stagger. Only
opacity and transform animate; reduced motion shows and hides it instantly. The Context panel renders at the document root on the shared glass
surface, above the pieces. Pieces switches between the home view and All pieces; there is no
author or piece picker, and a specialist's view opens from its mark while it works. Send
errors and designer recovery sit inside the composer's measured block, so the grid makes
room for them only while one shows. Long content retains native scrolling inside its
explicitly sized piece. To change reading space, save a validated placement in the
intended tab; do not override it in the renderer.

Organic's centered home and an explicitly expanded response hide pieces without
changing their rectangles. Visited pieces stay mounted while hidden. The server
validator, designer context and rendered workspace use the same chrome/agent
reservations. Model context includes row heights and actual pixel bounds so it
can judge the space available for a requested layout.

Diagrams use the shared Mermaid renderer's `canvas` variant: no well, border,
padding, type label, or repeated title. Recipes own their single heading. Piece
arrangement controls appear on hover/focus and stay available on touch. Organic and
its specialists render `OrganicAgentMark` (`components/agents/organic-agent-mark.tsx`),
the same material as Speak's center; no surface passes its own glass. The wordmark names
Organic once, so the mark's own name is kept for assistive tech only; specialists keep
visible names. On the home view the mark takes Speak's center size when its rows fit
(`hero` in `lib/stage/frame.ts`). Docked, at 700px and up, Organic centers on the
wordmark's axis (`--stage-rail`); its specialists keep their own cells and slide onto
that axis, one either side of it.
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
show that author's work and Pieces, in the top bar, exposes the workspace. On the home
view the response sits under Organic at the page center, with one control that gives it
the whole body. Visited
pieces stay mounted while tucked away, preserving diagram SVGs, chat and scroll
state. They render lazily on their first visit.

`lib/stage/views.ts` supplies the same owner-scoped view catalog to UI, Organic,
workers and voice. Whole, unambiguous navigation requests switch existing views
before generation/budget/lease work. They do not append transcript messages or
start jobs. Organic can also return a validated view action for requests that need
interpretation. Current selection, measured viewport and visible cells accompany
typed requests and live voice screen context; worker context includes the last
reported presentation. View commands have IDs and apply once, including voice's
immediate client effect, so later polling does not undo a manual choice. Specialists
publish work without changing selection. A design the user asked for that lands while
they are on Organic's home view (pieces tucked away) switches to All pieces, so the answer
is seen; a specialist or single-piece view is left alone.

The user watches the stage, not the transcript. Organic puts any substantive answer on the
stage through the designer and keeps its reply to a sentence or two; if a turn still returns
a long text-only reply (over 320 characters, no view or specialists), the server sends that
reply to the designer itself (`STAGE_REPLY_ON_STAGE_CHARS` in `lib/stage/turn.ts`).

Stage's composer is the same CoreInput as Arcadia's, in the same layout: the full
composer with its settings on the toolbar and the memory glow, in a column capped at
Arcadia's width (56rem), and the shared compact row once its shell is narrower than
600px. `variant="stage-beta"` changes behavior only: no file attachments, a send that
never becomes a stop, Stage's own saved settings, at most three thread references, and
the voice session control in the dictation mic's place. Stage's button, type and focus
resets in `stage.css` skip the composer, so nothing Stage-local restyles it. The grid
sizes the composer's rows from its measured height; the agents only compact once a
draft has grown the composer past 180px.

## Phone response space

Below 700px, the response reservation spans the full width on the home view and scrolls
independently. Organic's home identity uses wider chrome cells and sits slightly higher;
saved artifact placements are unchanged. Desktop reservations and artifact tab geometry
retain their existing behavior.
