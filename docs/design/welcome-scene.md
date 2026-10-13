# Welcome scene

**Locked: 2026-10-13.** The public welcome scene keeps the photographed pane and
live agent dots visible while its floor joins the themed Liquid Chrome background.

## Geometry and motion

- Desktop scene width is capped by viewport height so the glass stays inside the
  first screen on wide displays. Portrait screens use a separate photograph.
- `welcome-specimen-projection.ts` records each photograph's measured pane corners.
  A projective transform maps the square dot surface onto those four corners,
  including the difference between the pane's top and bottom slopes. It ships
  as a width-independent CSS transform (percentage translate plus
  `perspective(100cqw)` against the canvas container), chosen per theme and
  portrait media query, so the server-rendered pane is placed in the first frame
  and follows resizes without script. Remeasure corners when replacing an asset.
- The photo and projected dots share one camera transform. Pointer movement shifts
  that whole assembly, rather than moving the dots independently through the glass.
- The existing `organic-activity-grain` texture sits above dot diffusion on the
  projected pane. A larger tile compensates for projection scale; opacity is 40%
  in light mode and 30% in dark mode, with contrast 3.2. Grain stays sharp while dots diffuse, matching
  the supplied frosted-glass reference. Reduced-transparency preferences retain
  the shared texture's existing suppression.
- Existing live SVG dots use a restrained monochrome radial material for slight
  depth. The highlight faces the room's upper-left light;
  grain remains above the material. Both renderer variants use the same scoped
  fill, without changing agent marks elsewhere.
- Scroll progress comes from the `Page` scroll container. The camera tilt is bounded
  to 2.4 degrees and travel to 18 CSS pixels over the first viewport. Constants live
  next to the effect in `welcome-specimen.tsx`. Reduced motion removes both camera
  tilt and pointer parallax while retaining the geometric projection.

## Theme and continuity

- Light room color matches the approved paper material, `#f7f5ef`. Dark room color
  matches Liquid Chrome's blue-black base, `#080d12`. See
  [Liquid chrome materials](./liquid-chrome-materials.md).
- Separate light and dark photographs retain physical glass lighting. The dark
  photograph uses its own measured corners; do not invert the light photograph.
- Scene assets use WebP quality 98, static imports for content-hashed delivery, and
  unoptimized Image rendering to preserve grain and rim detail through one encode.
- The scene has no opacity exit. Static spatial masks blend only the outer room
  edges and floor into the room color, with the entire pane in the opaque region.
- Liquid Chrome enters through a 28svh spatial blend beneath the floor. Its sticky
  viewport keeps the WebGL surface at one viewport rather than the full document
  height. It mounts when the following content reaches view.
- Keep safe-area bottom spacing inside the footer, not on the outer `Page` scroll
  container. The Chrome layer must cover the full document through its bottom edge.
- The photographic pane supplies the glass material. Per-dot foreign-object glass
  covers and secondary refraction are disabled locally to preserve circles under
  projective transforms; other agent marks retain their materials.

## First frame and selection

- `app/page.tsx` passes a server auth hint, so signed-out visitors get the hero in
  the first HTML. Its `:has(.hero)` rule then hides the app sidebar and control
  cluster before Clerk loads; Clerk's client state takes over once loaded.
  Below-fold sections mount after hydration because their reveal motion depends
  on reduced-motion, which the server cannot read.
- Only reading copy is selectable: the hero headline and subline, plus section
  headings and body text below the fold. The scene, navigation, actions, scroll
  invite, illustrations and screenshots use `user-select: none`, and images are
  not draggable. Base styles make headings unselectable app-wide, so welcome
  headings opt back in.

## Verification

Projection unit tests check the four photographed corners at multiple sizes and
both portrait themes, plus a sloped interior dot row. Browser checks cover wide
desktop, portrait and short screens, theme changes, and several positions across
the floor transition. Scene opacity must remain 1 throughout scroll.
