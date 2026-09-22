# FluidGlass rendering in the voice drawer

**Status:** Accepted — fixes the approved FluidGlass integration. Geometry superseded by the
[amendment](#amendment--procedural-geometry-replaces-barglb) below; the rendering pattern stands.
**Date:** 2026-09-22
**Affects:** `components/voice/voice-fluid-glass{,-canvas}.tsx`, `components/voice/voice-glass-geometry.ts`

## Failure

The previous renderer used an oversized plane and an empty transmission scene. Its bevels
were outside the canvas, and there was no image for the transmission shader to refract.
The installed Drei shader samples the buffer's RGB without forwarding its alpha, so an empty
transparent buffer did not make the glass transparent as the component's comments assumed.

## Correction

Use the [ReactBits FluidGlass bar](https://github.com/DavidHDev/react-bits/tree/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Components/FluidGlass)
model and rendering pattern: a separate scene rendered into a framebuffer, then sampled by
`MeshTransmissionMaterial` on the rounded bar. The 41,552-byte GLB is served locally with its
upstream licence. No additional dependency is needed.

- Rotate and centre a clone of the cached geometry. Fit the height to the drawer and extend
  the middle to fit its width, preserving the curvature of the ends. Keep a one-pixel inset
  so the bevel remains visible.
- Replace the demo's scrolling image gallery with a small animated light field. The canvas
  refracts this field; the surrounding CSS glass still blurs the actual page. It does not
  refract DOM content or the overlaid SVG waveform.
- Keep the bar's material settings: thickness 10, IOR 1.15, zero roughness and chromatic
  aberration 0.1. Explicit material transparency lets the CSS layer show through.
- Lazy-load the renderer on the client. Loading, model errors, unavailable WebGL and context
  loss leave the CSS glass and voice controls usable.

## Performance limits

Constants live next to the renderer. Four transmission samples, DPR at most 1.5, and an
aspect-correct RGBA8 framebuffer at most 1024 pixels wide bound the per-frame workload.
The environment map is generated once at 64px resolution.

Slow-moving light does not need the waveform's display refresh rate. A 30Hz invalidation
timer drives a demand-only canvas. Hidden tabs and reduced motion stop the timer; preference
changes are observed live. A layout or material change can still request a static frame.
The animated light field supplies the motion, avoiding redundant fractal distortion in the
transmission shader.

### Measurement

Local Chrome, ANGLE Metal on Apple M1 Pro, isolated production-bundled `VoiceLiveBar`,
1280×800 viewport at device scale 2. The 670×30 CSS-pixel canvas rendered at 1005×45 pixels.
Five-second sample after loading and warmup; two render passes per glass frame. CPU numbers
time `WebGLRenderer.render`; GPU numbers use `EXT_disjoint_timer_query_webgl2` and include
both passes. They are renderer measurements, not whole-app or battery measurements.

| Measure | Mean | p95 |
|---|---:|---:|
| CPU render submission per glass frame | 0.23ms | 0.40ms |
| GPU elapsed per glass frame | 3.32ms | 7.62ms |
| Page frame interval | 16.67ms | 16.80ms |

The sample rendered 30.2 glass frames per second while the page maintained 60fps. An earlier
measurement with additional fractal distortion reported 7.53ms mean GPU time; it was removed
because the light field already provides the motion. These short samples are directional,
not a device-wide performance guarantee.

The renderer reported 14 geometries and 5 textures, including environment helpers. The
whole preview's JS heap was about 16.4MiB; this is **not** the incremental memory cost of glass.
Mobile hardware, sustained voice calls, total GPU memory and battery impact remain unmeasured.

## Verification

Browser checks covered 1280px and 390px layouts in both themes, successful local model loading,
the DPR cap, live reduced-motion changes, a simulated hidden-tab event, context loss, failed
model loading, unavailable WebGL, and ending/remounting the bar. The voice controls remained
usable in every graphics failure case. No uncaught page errors occurred in the normal path.

The preview imports the same components and styles as the app. The signed-in application lab
was not exercised because its browser session required authentication. Next.js served the
app root and the model successfully. Type checking and all 1,324 unit tests passed; the
renderer files passed ESLint. Full-repository lint has existing errors outside this change.

## Amendment — procedural geometry replaces `bar.glb`

**Date:** 2026-09-22

The rendering pattern above is unchanged. The mesh is not: the vendored `bar.glb` produced a
hard vertical seam near the drawer's right end, fixed in place while the light field moved, so
it was geometry rather than shading.

The model is not a symmetric bar:

| Region | Left | Right |
|---|---:|---:|
| End cap | 190 triangles | 902 triangles |
| Shoulder | 0 triangles | 144 triangles |

The right end carries overlapping shells from an export merge, including an inward-facing cap
inside the bar (x ≈ 2.32–2.70, |normal.x| up to 0.95). The whole mesh has 482 non-manifold edges
and 71 open edges. `MeshTransmissionMaterial` lets the viewer see through the shell to every one
of those faces. At the model's native ~7:1 proportion over the demo's photographs this is
masked; stretched to a ~28:1 drawer over a smooth light field, it shows.

Stripping the inward cap alone was tried and did not remove the seam — the overlapping right
shoulder remained. `createGlassBarGeometry` now builds a rounded, bevel-domed bar directly at the
drawer's size: closed, manifold and symmetric by construction, with welded normals so the bevel
refracts as one curve. It also removes the middle-extension hack, the model fetch, the GLTF
loader and the Suspense boundary. `thickness` is expressed as `GLASS_THICKNESS_PER_HEIGHT ×
height`, which reproduces ReactBits' `thickness: 10` on its 1.2-unit bar, because transmission
thickness scales with the mesh's world scale.

`tests/unit/voice-glass-geometry.test.ts` asserts the silhouette size, mirror symmetry, equal
geometry at each end, a closed manifold shell (0 open, 0 non-manifold edges) and unit normals.
The vendored model, its licence copy and README were removed from `public/assets/3d/`; the
upstream commit linked above still pins it if it is ever needed again. The canvas keeps its
ReactBits attribution for the rendering pattern.

Verified in an isolated production bundle at 32px (both themes) and 110px: symmetric ends,
chromatic rim fringing on both edges, and a specular band continuous across the full length.
Performance figures above were measured with the GLB. The procedural bar is comparable — 1,580
triangles against the GLB's 1,514 — and transmission cost is dominated by the framebuffer pass,
not vertex count, so they should hold; they were not re-measured.

