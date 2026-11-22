# Jev Stage prototype

Lab: [`/sandbox/prototypes/jev-stage`](../../app/sandbox/prototypes/jev-stage/page.tsx).
Real `/stage` and `/api/stage` are **untouched**. This fork keeps its own Redis namespace
(`jev-stage:…`) so it can promote later into Stage without a cutover surprise.

## Intent

Jev is the first hop on every turn — an intelligent switch, not the responder. It ranks:

- **Direct tools** that patch Stage programmatically (view, captures, recall, designer brief,
  specialists, memory search, web search) with no LLM phrasing when the tool owns the surface.
- **LLM tools**: **Respond** (streamed, $0.20 input / $0.10 output budgets) and **Orchestrate**
  (Arcadia-shaped system prompt + tools, including `dispatch_subagent`).

Downstream uses an NDJSON event stream (route → delta/patch → done), analogous to Arcadia’s
custom stream writer / AIData side channel.

## Turn loop

After Jev routes, execution is a bounded step loop (`JEV_STAGE_TURN_MAX_STEPS`):

1. Run the selected action (direct tool, Respond, or Orchestrate).
2. If a direct tool (or empty Orchestrate) leaves no Conversation line for this request,
   fall through to **Respond**.
3. Respond / Orchestrate allow up to eight AI SDK steps so lookups and Stage tools have
   room before the closing reply. Respond still applies its existing input and output budgets.
4. A final safety reply is written if the turn would otherwise complete with nothing visible.
5. The server sends heartbeats while the turn runs. When the stream loses contact,
   the client checks for the saved turn by request ID without sending the message again.
6. Designer jobs reuse Stage's generator and layout reconciler against the prototype store.
   Stage polls for queued and working jobs, shows progress, and opens Overview when new
   pieces land from the Organic view. Failed jobs offer a retry. Jev ranks the authorable
   gen UI formats from the design brief and the designer receives up to three relevant schemas.
   Plain source examples use fenced Markdown in a note. Diff blocks are for patches and
   before/after comparisons. If ranking is unavailable, the designer receives the full catalog.

## Code map

| Path | Role |
|------|------|
| `lib/jev-stage/` | Router, budgets, direct tools, respond/orchestrate streams, store, turn |
| `app/api/prototypes/jev-stage/` | GET bundle, POST NDJSON turn / reset, eval POST |
| `components/jev-stage/` | Hook + insight panel |
| `docs/migrations/jev_stage_turn_eval.sql` | Lean Supabase eval table |

## Sent message

The prototype echoes a submitted message beneath Organic while the turn runs. The two-line
preview opens in a scrollable popover when clipped. Organic’s action phrase uses Arcadia’s
processing shimmer. Route, fallback, model and tool updates
come from the turn stream. Once the reply is saved, the full message is available in
Conversation. A failed turn leaves the echo visible until retry or reset.

## Insight panel

On desktop, Conversation opens in a recessed column and Stage adjusts its width. The
fixed-height Insight note can move within the Stage area by dragging its grip or using the
arrow keys on the focused grip. Home returns it to its initial position. Mobile keeps the
Insight sheet opens from the Stage toolbar. Pieces stack in a full-width reading column.

Insight follows the latest interaction by default, including the in-flight turn. Paging back
pauses following. The Follow latest toggle or paging to the newest turn resumes it.

- **Pipeline** shows the route, top-three probabilities, confidence floor, tool results, step
  timing, spend, and fallbacks. Older turns use stored traces when available.
- **Context** shows the inputs captured for Jev, Respond and Orchestrate, plus expandable tool
  outputs, the message packing window and model usage. Input segment counts are estimates.
  Tool definitions list names and descriptions, and long stored text is capped. Cache reads
  are attributed to the model call because providers report totals at that level.
- The footer shows the turn's totals and evaluation controls. Context is kept with the
  lab’s authenticated, encrypted turn record.

## Confidence floor

`JEV_STAGE_CONFIDENCE_FLOOR = 0.45` (owner, 2026-11-21; gates direct tools and Orchestrate only: a top pick of `respond` always runs as a normal Jev decision) in `lib/jev-stage/constants.ts`. Tunable; threshold research
is out of scope for this lab.

## Promote recipe (later)

1. Capture legacy Stage screenshots.
2. Point Stage’s turn path at `runJevStageTurn` (or merge namespaces).
3. Keep insight panel opt-in until product accepts it.
4. Run the eval migration in production Supabase.
5. Bump app semver; do not delete the lab until the owner says so.
