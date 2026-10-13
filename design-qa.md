# Public welcome scene QA

final result: passed

## Visual evidence

- Source truth: `.private/homepage-living-specimen/final/reference.png`, the
  user-supplied Living Specimen mockup, 1586 × 992 raster pixels.
- Implementation: `http://localhost:3000/`, signed out. The user supplied the server.
- Latest light capture: `.private/homepage-living-specimen/final/desktop-light.png`.
- Full comparison: `.private/homepage-living-specimen/final/comparison.png`.
  Left is source; right is implementation. Source is normalized to 1280 × 800,
  matching the capture's 1280 × 800 pixels from a 1024 × 640 CSS viewport at 1.25×.
  The source mockup has no recorded CSS viewport or density; this comparison
  evaluates composition and material direction rather than claiming pixel identity.
- Focused glass comparison: `.private/homepage-living-specimen/final/glass-comparison.png`.
  Pane crops are normalized to 510 × 540 each to inspect grain, rim, dot diffusion,
  and perspective. Full-view navigation, headline, and CTA remain readable.
- Dark capture: `.private/homepage-living-specimen/final/desktop-dark.png`.
- Floor captures: `floor-light.png` and `floor-dark.png` in the same folder.
- Bottom-edge capture: `bottom-light.png`. After the padding fix, the WebGL field
  ends at y640 in a 640px CSS viewport; the page's outer padding is 0px.
- Responsive captures: `mobile-light.png`, `mobile-dark.png` (390 × 844 CSS,
  780 × 1688 raster), `mobile-short.png` (375 × 568 CSS), and
  `mobile-landscape.png` (767 × 390 CSS). Responsive captures preceded the final
  material-strength adjustment; layout and projection remained unchanged.

Native browser chrome is excluded. The development indicator is excluded where
the browser tool permits it. No product controls were hidden for QA.

## Required fidelity surfaces

- Typography: Satoshi retains the source's plain grotesk hierarchy. Headline,
  subtitle, navigation, and account action are live text with appropriate focus
  states. Fixed navigation and touch-target sizes adapt to the smaller viewport.
- Layout: restrained navigation and bottom copy/action composition remain intact.
  The smaller specimen and brighter room are explicit user-requested refinements.
  At 2048 × 1050 CSS the pane measures approximately x830–1447, y151–812 and fits
  fully. Portrait and short screens retain the complete pane; landscape uses the
  landscape asset and its projection.
- Color: near-white paper and near-black room colors join Liquid Chrome's material
  bases. Dark mode uses a separate photograph, legible pale text, and pale CTA.
- Images/material: real photographic glass remains, delivered as WebP quality98
  without a second quality75 encode. The existing production agent mark supplies
  live SVG geometry. Its shared grain texture covers the pane above dot diffusion;
  a restrained monochrome fill adds only slight depth. No replacement brand art.
- Copy: title, one explanatory sentence, Showcase, Sign in, Create account, and
  Scroll to explore match the chosen direction. Existing content follows below.

## Comparison history and resolved findings

- P2: wide desktop cropped the pane. Capped photo width by viewport height;
  measured the full pane inside 2048 × 1050 and recaptured desktop.
- P2: dots faced forward independently of the angled glass. Projected their
  surface to the measured four pane corners and shared the camera transform.
  Tests verify corners at multiple sizes and a sloped interior row.
- P2: portrait-to-landscape rotation retained portrait dot coordinates. Select
  geometry from the observed canvas aspect ratio; fresh landscape capture shows
  dots inside the landscape pane.
- P2: per-dot foreign-object covers rasterized as square patches under projection.
  Removed those covers locally; the photograph supplies the glass material.
- P2: texture disappeared through dot blur. Moved the existing grain onto a full
  projected surface above diffusion and strengthened it against the source crop.
  Reduced the final strength after user feedback to 40% light / 30% dark opacity
  with contrast3.2.
- P2: initial sphere shading changed the dots too strongly. Removed contact
  shadows and bright shading; retained the original dark silhouette with a very
  small monochrome tonal range, then recaptured the refined material.
- P2: a 16px outer page padding exposed a flat strip below the footer. Removed
  outer padding and retained safe-area spacing inside the background-covered footer.

No actionable P0/P1/P2 layout or implementation findings remain. Final material
strength remains subject to the user's visual preference.

## Behavior and validation

- Scroll at 420/640 viewport progression produces a 1.575° camera tilt and
  −11.8125px travel. Scene and canvas opacity remain 1.
- Both floor transitions show spatial blending into the following background.
  WebGL remains one viewport in size rather than the document's full height.
- Sign in opens the existing Clerk form. The account action retains Clerk's
  current access policy; sign-ups are restricted by its configuration.
- The scroll-invite handler and existing feature anchor remain in place.
- Reduced motion removes camera motion; shared reduced-transparency and contrast
  preferences suppress the added grain. These branches were checked in code.
- Browser diagnostics show existing signed-out voice-status Clerk CORS failures
  and existing below-fold image-quality warnings. No new scene runtime error.
- Unit suite: 1997 passed, 0 failed. Projection tests include 42 geometric checks.
- Changed TypeScript files pass ESLint. Full repo lint reports 52 existing errors,
  including other worktree files; no unrelated fixes were made.

## Asset provenance

Built-in ImageGen edited the selected scene into matching light/dark desktop and
portrait photographs. Prompt: preserve the empty angled glass, camera, rim, and
floor shadow; match room boundaries to paper #f7f5ef or dark #080d12; no text,
dots, or UI. Final files live under `public/images/welcome/` as
`living-specimen-scene-{light,dark}.webp` and
`living-specimen-scene-mobile-{light,dark}.webp`.

## Implementation checklist

- [x] Retain selected composition and real agent mark.
- [x] Fix desktop crop and dot projection.
- [x] Blend both themed floors without scene opacity exit.
- [x] Preserve image detail and restore full-pane grain.
- [x] Check responsive layout, primary auth entry, diagnostics, and required tests.
- [x] Leave the user's server under their control.
