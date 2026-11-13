# Rabbit-hole tool presence

Arcadia's rabbit-hole tools render `components/chat/rabbit-hole-tool-presence.tsx`, routed
through the shared `OrganicToolCallPresence` for current and historical tool parts. It is a
member of the generic tool pill family: same glass surface, radius, padding and 24px mark,
so a rabbit hole reads as an Organic tool result rather than a separate widget.

## Shape

One row, then folded secondary detail:

- **Mark** — the sidebar's rabbit-hole `SessionGlyph` (stem, node, forks), not a new
  drawing. It uses the glyph's `grow` idiom only while the tool is in flight; completed
  transcript cards stay still. Reduced motion is handled by the glyph's own stylesheet.
- **Text** — the title (or search query) on one line, the status on a second muted line:
  “Rabbit hole created · writing article”, “Rabbit holes searched · 8 found”.
- **Action** — a compact glass chip (`glass({ chip: true })`, rounded-full, 28px tall)
  with a 44px hit area from an expanded `::before`, so the target is large without making
  the row tall. “Open” for sessions, “View” for drawer node navigation. Focus uses Lumen
  via `organic-focus`.

Folded below, as native disclosures that stay out of the way until asked for:

- **Key points** (creation tools) — loaded from one node's `key_takeaways` on first open via
  `lib/rabbit-holes/key-points.ts` (one column, RLS-scoped; never the whole session). The
  article is usually still being written when the card first appears, so an empty result
  says so quietly and reopening retries. It never polls.
- **Results** (search and list) — up to six compact rows: title plus the one-line description
  the tool already returned. The model still sees the full list.
- **Tool details** — raw output, development instances only (see below).

Branch suggestions are not shown on the card: they belong inside the rabbit hole.

## Rules

- These are transcript snapshots, not live job monitors. Failed tool outputs (`ok: false`)
  never show success, key points or navigation.
- Open links are built from session IDs and always stay on `/rabbitholes`; tool-supplied URLs
  are ignored. Drawer generation/navigation tools keep their node-open event.
- The card is fixed-height per state: no ongoing animation, no shared SVG IDs, no timers.

## Tool details are dev-only

Raw tool payloads are a development and debugging aid, not product UI. Gen-ui tool
components show them only when `SHOW_TOOL_DETAILS` (`lib/chat/tool-details-visibility.ts`)
is true, which is `NODE_ENV === "development"`. Vercel previews and production build with
`NODE_ENV=production` and never show them. Components accept a `showToolDetails` prop so
tests can render both branches. Content that happens to live in a tool payload (a Mermaid
diagram in the generic pill) is not a tool detail and still expands in production.

Visual checks should include light/dark themes, 320px width, long titles, opened key points
and results, and reduced motion.
