# Rabbit-hole tool presence

Arcadia's rabbit-hole tools render `components/chat/rabbit-hole-tool-presence.tsx`, routed
through the shared `OrganicToolCallPresence` for current and historical tool parts.

**Owner direction, 2026-11-13.** A rabbit hole is an exploration made of articles, and its
tool results must look like that. They must not look like the generic tool pill used by web
search, because the two are different things. Like the comparison and code blocks, each card
shows the high-value part of its payload in the shape that suits it, rather than a line of text
and an arrow. Everything in a card should be readable at a glance while scrolling a thread.

## Language

The cards borrow the rabbit-hole app's language, from `lib/rabbit-holes/designTokens.ts`
and the explorer:

- **Surface:** the app's card (`bg-card/80`, border, `rounded-lg`, light shadow). SessionCard's
  accent hairline appears on hover and focus, because the card leads into an exploration.
- **Type:** exploration and article titles use Commissioner light, the app's voice. It is
  mounted globally, so it is available in chat. Meta is 11px tabular.
- **Path rail:** one dot per article on a spine, and indented branches with an elbow.
  - A filled foreground dot marks the root.
  - An accent dot with a halo marks a new article.
  - A hollow accent ring marks one that is being written.
  - A hollow muted dot marks a parent that appears only to show where something attaches.
- **Open:** an exploration's title is its link, with an expanded 44px target and Lumen focus.
  Links are built from session IDs and always stay on `/rabbitholes`. There are no node deep
  links, so tree rows are not links. Drawer tools keep the "View article" node-open event.

## Shape per tool

| Tool | Shown at a glance | Folded |
|------|-------------------|--------|
| `create_rabbit_hole` | Title as a heading, then its first article as a node (the question it answers, ringed while writing), "Rabbit hole created · writing the article" | Key points (lazy) |
| `create_rabbit_hole_node` | The exploration's title, then a tree: parent → new branch | Key points (lazy) |
| `search_rabbit_holes` | Query plus count; top 3 explorations, each with its title, description, matched articles as a tree, and "N articles · date"; matched terms marked | The rest, as compact rows |
| `list_rabbit_holes` | Top 3 explorations, as for search | The rest |
| `get_rabbit_hole` | Title, description, and the article tree (up to 7 rows, depth-first, generating node flagged) | Remaining articles |
| `get_rabbit_hole_node` | Title, question, the first 3 key takeaways (or the section outline when there are none), and "N sections · N branches" | Further takeaways, outline |
| `get_rabbit_hole_node_section` | Section heading, a 4-line excerpt, "n of N" | — |
| Drawer tools | The node as a single dot row, status, "View article" | — |

The branch creation output carries `parentTitle` and `sessionTitle`. These are display fields
added by the tool, which already has the session loaded. The card makes no on-mount reads.
Key points load from one node's `key_takeaways` only when the disclosure opens
(`lib/rabbit-holes/key-points.ts`: one column, RLS-scoped). An unwritten article says so
quietly, and reopening retries. Branch suggestions belong inside the rabbit hole, not on chat
cards.

## Rules

- These are transcript snapshots, not live job monitors. In-flight cards show the sidebar's
  rabbit-hole glyph (its `grow` idiom); completed cards never animate.
- Failed outputs (`ok: false`) never show success, key points or links. Malformed creation
  output never claims a creation.
- Height comes from the data: no eyebrows, art blocks or chrome rows. Secondary detail folds
  into native disclosures that close the card like a footer.
- No shared SVG IDs, timers or per-frame work. The hover hairline and disclosure chevron are
  the only transitions, and reduced motion removes them.

## Tool details are dev-only

Raw tool payloads are a development and debugging aid, not product UI. Gen-ui tool
components show them only when `SHOW_TOOL_DETAILS` (`lib/chat/tool-details-visibility.ts`)
is true, which is `NODE_ENV === "development"`. Vercel previews and production build with
`NODE_ENV=production`, so they never show them. Components accept a `showToolDetails` prop so
tests can render both branches. Content that happens to live in a tool payload, such as a
Mermaid diagram in the generic pill, is not a tool detail and still expands in production.

## Checking it

`/sandbox/prototypes/rabbit-hole-tools` renders the real component with stubbed payloads for
every shape, stacked as in a thread. Check light and dark themes, 320px
width, long titles, opened disclosures and reduced motion there.
