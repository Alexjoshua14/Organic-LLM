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

- **No card.** Like the comparison block, the content sits directly in the thread with no
  border, fill or padding box. A card confined it and set it apart from the conversation.
  Structure comes from type, the tree and spacing.
- **One system for meta.** Every result opens with the same quiet 11px line: what happened
  and its counts ("Branch created · writing the article", "Article read · 3 sections",
  "persona memory · 6 results"). The content follows. The eye finds the same kind of
  information in the same place on every card, instead of hunting for it from card to card.
- **Type:** exploration and article titles use Commissioner light, the app's voice. It is
  mounted globally, so it is available in chat. Meta is 11px tabular.
- **Path rail:** one dot per article on a spine, and indented branches with an elbow.
  - A filled foreground dot marks the root.
  - An accent dot with a halo marks a new article.
  - A hollow accent ring marks one that is being written.
  - A hollow muted dot marks a parent that appears only to show where something attaches.
- **Open:** the app's primary ink pill (`--primary`, as Button's default variant) with
  "Open rabbit hole ↗", in an action row under the content. It is not an accent tint (the
  owner rejected the teal) and not a bare title link (which read as plain text). It is 32px
  tall, with a 44px hit area and Lumen focus. Links are built from session IDs and always stay
  on `/rabbitholes`. There are no node deep links, so tree rows are not links. Drawer tools use
  the same pill for "View article" (the node-open event).
- **Secondary toggles** (Key points) sit beside Open as a quiet outlined pill. Their content
  opens below the row.
- **Key points** are a numbered list: accent tabular numerals in their own column, 10px
  between points, and a bold lead when a point reads "Lead: rest" or "Lead — rest".

## Shape per tool

| Tool | Shown at a glance | Folded |
|------|-------------------|--------|
| `create_rabbit_hole` | Title as a heading, then its first article as a node (the question it answers, ringed while writing), "Rabbit hole created · writing the article", then Open and Key points | Key points (lazy) |
| `create_rabbit_hole_node` | The exploration's title, then a tree: parent → new branch | Key points (lazy) |
| `search_rabbit_holes` | One quiet 11px line: a small search icon and the query (truncated) … "N results", in one shared style. The query is context, so the results get the space. Then up to 4 folded rows (title with matched terms marked, "N articles · date", chevron; the meta hides below 480px) | Each row opens to its description, matched articles as a tree, and Open. Further results join the same list through "Show N more" at its foot, which becomes "Show less" |
| `list_rabbit_holes` | The same folded rows, under "Your rabbit holes" | As for search |
| `get_rabbit_hole` | Title, description, and the article tree (up to 7 rows, depth-first, generating node flagged) | Remaining articles |
| `get_rabbit_hole_node` | Title, question, the first 3 key takeaways (or the section outline when there are none), and "N sections · N branches" | Further takeaways extend the same list ("Show N more" / "Show less"); outline |
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
- Height comes from the data: no eyebrows, art blocks or chrome rows. Lists grow in place
  from a toggle at their foot; never a separate "more" section mid-content.
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
