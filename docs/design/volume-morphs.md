# Volume morphs

Open `/sandbox/prototypes/volume-morphs` and select a scenario. **Move B** moves the left-hand square toward the midpoint. Change the target coordinates or dimensions and submit again during motion to retarget. Gutter changes reset the fixture. The flat grid follows Organic's Stage grid and controls, with depth intervals shown in the piece list.

- **Equal peers** splits the clearance between the two squares.
- **Fixed blockage** leaves A in place. B stops at the gutter and briefly fades.
- **Depth clearance** starts B above A's depth interval. Try a lower depth while approaching A to exercise swept contact.

The designer can interpret “Place C at x 4, y 2” and “Move C to x 5, y 8”. The route returns one structured operation and the browser checks it against the current scene. Newly placed pieces default to fixed. Scene changes last until reset or navigation.

`llm/morph-physics/src/physics/volumeScene.ts` provides the scene controller and swept volume checks. Coordinates specify the near face along each axis. The gutter applies in the XY plane when depth intersects. The animation follows a linear geometric path driven by the existing regular spring, retaining its projected velocity on a same-piece retarget. The contact pulse lasts 180 ms and affects opacity only. Reduced motion settles immediately and keeps the blocked status text.

The solver clips straight paths and tries local pairwise accommodation. Multi-piece packing and automatic detours are outside this lab. Review browser behavior and motion before any Stage integration.

For a future promotion, begin by comparing the three fixtures in both themes and at phone and desktop widths. Capture the existing Stage behavior before wiring its layout to the package, then rerun the rectangle and volume tests.
