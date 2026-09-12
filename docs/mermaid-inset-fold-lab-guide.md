# Mermaid inset fold — lab guide

**Goal:** Make the inline diagram read as a *recess in the thread surface*, not a separate card. The thread background shows through unchanged; only top and bottom edge shadows suggest a page fold.

**Ticket:** [COA-184](https://linear.app/coalescence-labs/issue/COA-184/mermaid-inset-page-fold-well-no-background-shift)

**Lab URL:** `/sandbox/prototypes/mermaid` — use Light / Dark / Reduced motion toggles after each change.

---

## What you are changing (and what you are not)

| Touch | File | Leave alone |
|-------|------|-------------|
| Well chrome (fold shadows, no fill) | `lib/mermaid/presentation.ts` → `mermaidWellClass` | `buildMermaidGlassStyleMarkup()` — SVG node styling |
| Optional CSS tokens / keyframes | `styles/globals.css` | `mermaid-reveal` timing (already respects `motion-reduce`) |
| Lab fixtures & toggles | `app/sandbox/prototypes/mermaid/page.tsx` | Takeover shell, tool wiring, node chips |

**Consumers of `mermaidWellClass`:** `components/blog/mermaid-diagram.tsx` (inline + error path) and `components/mermaid/mermaid-tool-diagram.tsx`. Editing the export updates chat and lab together.

---

## Step 1 — Strip the “card” cues

Open `lib/mermaid/presentation.ts`. Today `mermaidWellClass` adds a tinted fill and inset ring:

```ts
"bg-background-tertiary/25 dark:bg-background-secondary/40",
"shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
"ring-1 ring-inset ring-border/35",
```

**Remove** background tint and ring. Keep layout shell: `relative`, `my-4`, `w-full`, `overflow-hidden`, `group/mermaid-well`.

**Pass check:** Place the well on the same `bg-background` as the message column. Squint — you should not see a rectangle of different color behind the SVG.

---

## Step 2 — Add fold shadows (top + bottom)

The fold is *only* edge treatment: darkened `var(--background)` cast inward so the center feels pressed into the page.

**Approach A — pseudo-elements in CSS** (recommended for iteration):

In `globals.css`, add a utility, e.g. `.mermaid-well-fold`, and apply it from `mermaidWellClass`:

```css
.mermaid-well-fold::before,
.mermaid-well-fold::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 10px; /* tune 6–14px */
  pointer-events: none;
  z-index: 1;
}
.mermaid-well-fold::before {
  top: 0;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--background) 55%, black 45%),
    transparent
  );
}
.mermaid-well-fold::after {
  bottom: 0;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--background) 55%, black 45%),
    transparent
  );
}
.dark .mermaid-well-fold::before,
.dark .mermaid-well-fold::after {
  /* dark mode often needs a lighter mix — e.g. 70% background / 30% black */
}
```

**Approach B — stacked box-shadows** on the well (faster to prototype, harder to tune):

```ts
"shadow-[inset_0_8px_12px_-8px_color-mix(in_srgb,var(--background)_40%,black_60%),inset_0_-8px_12px_-8px_color-mix(in_srgb,var(--background)_40%,black_60%)]"
```

Tune until the fold reads in **both** themes without looking like a bordered box.

---

## Step 3 — Verify hover controls still work

Controls live in `mermaidControlsClass` (absolute top-right, `opacity-0` until `group-hover/mermaid-well`). With transparent well + `::before`/`::after` overlays:

- Set `pointer-events: none` on fold layers.
- Keep control buttons on `z-10` (already in `mermaidControlsClass`).
- Confirm focus-within still reveals controls (keyboard tab to expand/copy).

**Pass check:** Hover each fixture in the lab — rail appears; no dead click zones on the diagram.

---

## Step 4 — Lab walkthrough (guided)

1. Start dev server → open `/sandbox/prototypes/mermaid`.
2. **Light** → fix **Subgraph** fixture (cluster rects are the contrast stress test).
3. **Dark** → same; folds should not blow out to gray slabs.
4. Toggle **Reduced motion** → reveal should snap in (`mermaidRevealClass` uses `motion-reduce:animate-none`); fold shadows are static — no animation needed.
5. Optional: add a “thread context” strip in the lab page — a `bg-background` column with fake message text above/below one fixture so you judge continuity vs. the surrounding thread (not the lab card chrome).

---

## Step 5 — Chat thread smoke test

1. Trigger a diagram in a real chat (or use showcase trace with mermaid tool).
2. Scroll the diagram between messages — it should feel *embedded*, not pasted.
3. Double-click expand still works (`variant === "inline"` → takeover strips extra well chrome via `shadow-none`).

---

## Definition of done (COA-184)

- [ ] No well background fill or card ring
- [ ] Top-edge fold shadow using `var(--background)`-based darkening
- [ ] Bottom-edge fold shadow (matched weight)
- [ ] Hover/focus controls readable on transparent well
- [ ] Sandbox lab verified (light + dark + reduced motion)
- [ ] Chat thread verified
- [ ] Commit + close ticket

---

## Quick reference

```text
presentation.ts   mermaidWellClass, mermaidWellInnerClass, mermaidRevealClass
globals.css         @keyframes mermaid-reveal (lines ~714+)
mermaid-diagram.tsx applies well + reveal on inline variant
sandbox page        theme / motion toggles, FIXTURES array
```

**Design intent** (from `docs/mermaid-diagram-design.md`): *“a recessed surface that belongs to the message, not a floating card.”* The fold inset is the visual shorthand for that recession — depth without a new surface color.
