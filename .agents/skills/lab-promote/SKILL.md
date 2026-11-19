---
name: lab-promote
description: >-
  Runs the lab-to-production path for a UI piece: build in a sandbox lab without touching the
  shipped component, then "promote" it with legacy screenshots captured first, the swap, tests,
  docs, evidence and tracking. Use when the owner says prototype, lab, "build this out as a
  prototype", "don't touch the real X", "promote", "fold it back in" or "ship the new version",
  or names CoreInput v3, the Gen UI Lab, a Current-vs-Next page, or any app/sandbox/prototypes
  entry. For the subagent card specifically, subagent-card-lab is the more specific skill.
---

# Lab to promote

Labs under `app/sandbox/prototypes/` (and the Subagent lab) are where Organic's UI is designed.
The shipped component stays a **baseline** until the owner says promote. The owner directs each
visual change; do exactly what is asked, say where you had to adapt, and flag performance gaps
and bugs as you find them rather than guessing.

## Before building

1. Find the lab and its doc. Registry: `app/sandbox/prototypes/_config/prototypes.ts` (slug,
   `about`). The doc under `docs/design/` owns the file map and the promote recipe (for example
   `core-input-compact-reflow.md`, `subagent-card-lab.md`). Read both. If the card is the
   subagent card, follow [subagent-card-lab](../subagent-card-lab/SKILL.md) instead.
2. Claim the paths and any port with [agent-radar](../agent-radar/SKILL.md). Labs are often
   edited by two agents at once.
3. A new lab: a folder `app/sandbox/prototypes/<slug>/` with `page.tsx`, an entry in
   `prototypes.ts`, a doc under `docs/design/`, and links from `docs/design/README.md` and
   `docs/INDEX.md`. In `about`, `authorThoughts` holds only the owner's own words from their docs
   or messages, never your filler; if you have none, set `adminQuestion`.

## While it is a prototype

- **Edit the prototype only.** Do not touch the shipped component. Keep it one component: the
  owner does not want a design forked across the app unless they say so. Shared files get opt-in
  props so the shipped version is unchanged.
- **Tokens, never literals**, in lab files too ([design-backbone](../../rules/design-backbone.md)
  8 and 9). Run [design-guard](../design-guard/SKILL.md) on your paths before reporting.
- Follow the owner's UX exactly. Where the design is theirs ("a new sort of UI"), do not fill
  gaps with convention; ask.
- Verify on a running server at phone, desktop and wide, both themes. Ask before starting one.
- Leave work uncommitted unless asked.

## Promote

Only on "promote", "ship it" or equivalent. Commit and PR steps happen only if the same request
asked for them; otherwise stop with a working tree ready and say so.

1. **Capture the legacy UI first.** Before replacing anything, screenshot the soon-to-be-legacy
   component at phone and desktop, dark and light, with synthetic content (this repo is public:
   no real user data, tokens or private URLs). If a write-up is likely, save them under
   `public/blog/<slug>/legacy-*.png` ([blog-from-work](../blog-from-work/SKILL.md)); otherwise
   keep them for the PR (below). Once the swap lands, the old UI is gone, so this cannot wait.
2. **Diff Current against Next.** List changed props, behaviour and consumers
   (`grep` the importers), and the tests that assert the old markup.
3. **Swap** per the lab doc's recipe (rename, fix imports, carry opt-in props). Next and the lab
   stay in place unless the doc says otherwise; never delete them unprompted. If the doc has no
   promote section, add one in the same change.
4. **Update tests and docs in the same change:** the design doc (new approved values and why),
   `docs/INDEX.md` if a doc was added, and the design-backbone pointer if agents must apply it.
   Bump the version with [app-semver](../app-semver/SKILL.md): promotion changes shipped behaviour.
5. **Verify:** `bun run lint:check`, `bun run test:unit`, `bunx tsc --noEmit`, and
   `bun run design:guard --paths <your files>`. Check the promoted component on a running server,
   both themes, phone and desktop.
6. **Evidence for the PR.** Before and after at the same widths and themes, synthetic content.
   Mechanism used so far: push an evidence-only orphan branch `pr-assets/<branch>` (images at its
   root, no history) and embed SHA-pinned `raw.githubusercontent.com` URLs in the PR body.
   Refresh them if later pushes change the visuals.
7. **Track:** PR to `develop`, never `main`. In Ergon move the issue to **In Review**, attach the
   PR and the evidence URLs with `create_attachment` (it takes URLs, not files), and record any
   decision the promotion embodies per the hub protocol.
8. **Hand back:** what changed, what was verified and what was not, what remains, and the legacy
   captures' location. Offer [blog-from-work](../blog-from-work/SKILL.md) if the change tells a
   story worth publishing.
