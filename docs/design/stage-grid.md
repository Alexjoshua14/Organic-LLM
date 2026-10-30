# Stage grid motion

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
