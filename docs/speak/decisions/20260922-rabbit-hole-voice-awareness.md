# Rabbit-hole voice awareness: the open node first, then the map

**Status:** Accepted
**Date:** 2026-09-22
**Supersedes:** the rabbit-hole body described in section 3 of
[Ambient voice presence](./20260922-ambient-voice-presence.md). The transport in that section
stands.
**Affects:** `lib/speak/ambient-context.ts`, `lib/speak/ambient-item.ts`,
`lib/schemas/speak-screen-context.ts`, `components/rabbit-holes/RabbitHoleShell.tsx`,
`hooks/use-realtime-voice.ts`

## Context

On a rabbit-hole page, the voice agent should know two things without being asked: what the open
node says, and where it sits in the exploration. The first version sent a one-line gist for up to
12 nodes plus a `parent → child` edge list. Four problems:

1. **The open node could vanish.** Nodes were taken with `Object.values(nodesById).slice(0, 12)`
   — insertion order — so in a deep hole the node on screen, usually the newest, was cut.
2. **Its summary got 420 characters,** the same as every other node. Stored summaries run to
   ~1,500 words.
3. **A fresh branch never delivered its summary.** Branching makes the new node active before
   its article exists, and the push only re-fired when the node *id* changed.
4. **Late replies won.** Clicking through nodes fires overlapping `/context` requests; whichever
   resolved last was pushed, even when it described a node the user had already left.

## Decision

### Transport stays `conversation.item.create`, not `session.thinking.append`

`session.thinking.append` is the purpose-built "context the model should not speak" event — but
only in **GPT-Live** (`gpt-live-1`, `/v1/live`), a separate API whose tools run through
delegation. Speak runs `gpt-realtime-2.1-mini` over `/v1/realtime/calls`, where the event does not
exist. Confirmed against the
[GPT-Live context guide](https://developers.openai.com/api/docs/guides/live-conversations#provide-history-and-context),
the [Realtime conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations),
and `openai@7.22.0`, which types `thinking.append` under `resources/live` only.

Adopting it is a migration of the whole session — events, tools, billing — not a change to this
builder. Whether to migrate is an open question in `organic-llm-hub/speak/open-questions.md`
(private). Until then the silent system item from the presence ADR is the correct Realtime
mechanism.

### The body leads with the open node

```
The user is reading the rabbit hole "…", on the node "…".

What "…" (the user asked: "…") covers:
<stored summary, first 1,000 chars>

Map of the rabbit hole (indented = branched from the node above):
- Root
  - Open node ← on screen
    - Its child
  - Sibling
(…and N more nodes not shown)
```

- **Only the open node carries a summary.** Other nodes appear by title in the map. Within 600
  tokens, a deep slice of what is on screen beats a shallow gist of everything.
- **Summary fallback:** stored `summary` → `keyTakeaways` → `preview`. A node whose article is
  still generating says so, so a quick preview is not presented as the finished article.
- **The map is built from `path`**, the same parent links the article generator uses
  (`lib/rabbit-holes/collect-related-nodes.ts`). `edges` mirrors them but admits non-tree types.

### The map is sized to what the lead leaves

`fitAmbientBody` drops whole sections from the tail, so a map that overran the budget would
vanish entirely. Instead, the map is sized to the budget left after the lead, adding nodes in
priority order until the next would not fit: the open node, its ancestry nearest-first, its
children, then everything else breadth-first. A cut ancestry renders as `… ›` rather than posing
as the root. Capped at 16 nodes. A test builds the worst case — 60 nodes, 80-character titles,
500-character questions, a ~11k-character summary — and asserts both survive under budget.

### Re-push when the article lands

The rabbit-hole descriptor gains `activeNodePending`, which is part of the surface key and is
never read by the server. It flips when `useGenerationCompletion` swaps in the finished session,
which re-pushes the node with its summary.

### Latest surface wins

`sendScreenContext` sends only if its key is still the claimed one when the reply arrives. A
superseded request is dropped rather than overwriting newer context.

## Consequences

- A typical hole costs ~160 tokens per push; the ceiling is still `SPEAK_AMBIENT_MAX_TOKENS`.
- The agent can no longer recite other nodes' gists from ambient context, only their titles and
  placement.
- Superseded ambient items still accumulate in the conversation until `retention_ratio`
  truncation evicts them. Deleting the prior item with `conversation.item.delete` would stop that,
  but a delete that races truncation returns a server `error`, which the hook currently surfaces
  to the user. Not done here.

## Open

- **Background changes to the map** — a branch finishing while the user reads another node —
  do not re-push, because the key does not change. The next navigation catches up.
