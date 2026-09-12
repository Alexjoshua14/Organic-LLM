# Mermaid diagrams — design thread

Design direction for how generated diagrams present themselves in chat. Complements
[chat tools](./chat-tools.md) (tool wiring) and [organic presence](./organic-presence.md) (motion language).

Status: **Phase 1–4 implemented** (well styling, dual-source tool, takeover shell, composer chips). Numeric thresholds marked _(proposed)_ still need confirmation in the sandbox lab.

## Problem

The current diagram renders as a compartmentalized block dropped into the thread — a
foreign object rather than part of the answer. The redesign should make a diagram feel
intertwined with the chat surface, intentionally composed, and slightly alive.

## Density tiers

The model declares intent; each tier is a different presentation, not just a size change.

| Tier | Job in the message | Node count _(proposed)_ |
|------|--------------------|-------------------------|
| `glance` | A visual aside that punctuates the prose | ≤ 5 |
| `overview` | The answer's structure, fully readable inline | 6–12 |
| `detailed` | A reference you go into | 13+ |

- Tiers form a rhythm, not a resolution ladder — the model picks the tier that serves the answer.
- All three tiers can expand; `glance` and `overview` are not inline-terminal.

## Tool contract

The generator emits **both** renderings in a single tool call:

- `overview` — the simplified graph: fewer nodes, the gist.
- `detailed` — the full graph.
- Node IDs are **stable and shared** across both. A node appearing in each must carry the
  same ID. This is the hinge the entire motion design hangs on — without it there is no
  continuity to animate.
- Both renderings pass the existing validate-and-repair loop independently
  (`lib/mermaid/validate.ts`).

## Inline presentation

- **Containment: a well.** The diagram sits in a recessed surface that belongs to the
  message, not a floating card with its own border and chrome.
- **Legibility: preview.** Inline shows the `overview` rendering — a genuinely simplified
  graph, not a scaled-down full one.
- **Controls are hover-revealed.** No persistent button rail. Expand, export, and node
  affordances surface on hover/focus and recede otherwise.
- **Aliveness: reveal on arrival.** The diagram composes itself into place when it lands
  rather than popping in. No idle animation, no ambient motion.
- **Palette: full.** Diagrams use the app's design tokens rather than Mermaid's defaults.

## Expanded takeover

Triggered from the inline diagram. The diagram becomes the subject of the screen.

**Surface**

- Full-screen takeover with its own chrome.
- Core-input remains present.
- Open sidebars collapse as part of the same transition.
- The chat thread gives way to diagram chrome.
- **Shallow URL update** so browser back exits the takeover. Not a separately loadable page.

**Choreography** — driven by [`@organic-llm/morph-physics`](../llm/README.md), spring-based
Vector4 `(x, y, w, h)`:

1. Measure the diagram's live rect in the thread.
2. Measure its resting rect in the takeover chrome.
3. Spring between them while the surrounding shell reorganizes.

**Content continuity.** Position and content change together, with shared identity preserved:

- Nodes present in both `overview` and `detailed` travel from their overview position to
  their detailed position.
- Newly revealed nodes fade in around them.
- This is why shared node IDs are a hard requirement, and why both layouts must be
  computable before the morph starts.

Reverse the morph on exit. Honor `prefers-reduced-motion` with a cross-fade.

## Node interaction

Clicking a node opens a small popover with intents:

- Explain this
- Expand this branch
- Open rabbit hole
- Chat about this

### "Chat about this" → composer link chip

Modeled on Cursor's code-selection pill (`TS validate.ts (150-152)`): a compact chip
above the textarea indicating what will be sent with the next message.

- Lives in `PromptInputHeader` in `components/chat/core-input/core-input.tsx`, alongside
  file attachments.
- Dismissible.
- Reads as a reference, not a tool toggle — visually distinct from the composer chips in
  `composer-tool-chip.tsx`.

### Context sent to the model

Scoped deliberately: enough to reason about, cheap enough to always include.

- The node's label
- Its immediate neighbors and the edges connecting them (including edge labels)
- The diagram's title and declared intent

Not the full Mermaid source, and not the originating assistant message.

## Open items

- Confirm node-count thresholds per tier in the sandbox lab (`/sandbox/prototypes/mermaid`).
- **Chips:** separate chips per linked node, hard cap **10** (11th is a no-op with a brief hint).
- **Expand this branch:** if not yet in detailed view, reveal the subgraph already in `detailed`; if already detailed, model deepens that branch (deepen path stubbed — toast until deepen tool ships).
- **Export (default):** copy Mermaid source + download SVG (hover controls on interactive diagrams).
- Rabbit-hole open from node remains stubbed (toast) until deep-link exists.
