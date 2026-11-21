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
3. Respond / Orchestrate use the AI SDK `stopWhen: stepCountIs(…)` tool loop so tool calls
   can continue into a visible reply instead of ending the turn blank.
4. A final safety reply is written if the turn would otherwise complete with nothing visible.
5. The client aborts hung streams after `JEV_STAGE_CLIENT_TIMEOUT_MS` so Stage cannot stick
   on a pending turn.

## Code map

| Path | Role |
|------|------|
| `lib/jev-stage/` | Router, budgets, direct tools, respond/orchestrate streams, store, turn |
| `app/api/prototypes/jev-stage/` | GET bundle, POST NDJSON turn / reset, eval POST |
| `components/jev-stage/` | Hook + insight panel |
| `docs/migrations/jev_stage_turn_eval.sql` | Lean Supabase eval table |

## Sent message

The prototype echoes a submitted message beneath Organic while the turn runs. The two-line
preview opens in a scrollable popover when clipped. Route, fallback, model and tool updates
come from the turn stream. Once the reply is saved, the full message is available in
Conversation. A failed turn leaves the echo visible until retry or reset.

## Insight panel

Desktop: sticky-note sized card (`w-64`, `max-h-80`). Mobile: collapsed chip → sheet.
Paged turns; message capped to two secondary lines; top-3 confidences + popover for the rest;
three-line glance for cost / latency / cache / per-model spend; thumbs + optional note.

## Confidence floor

`JEV_STAGE_CONFIDENCE_FLOOR = 0.45` (owner, 2026-11-21; gates direct tools and Orchestrate only: a top pick of `respond` always runs as a normal Jev decision) in `lib/jev-stage/constants.ts`. Tunable; threshold research
is out of scope for this lab.

## Promote recipe (later)

1. Capture legacy Stage screenshots.
2. Point Stage’s turn path at `runJevStageTurn` (or merge namespaces).
3. Keep insight panel opt-in until product accepts it.
4. Run the eval migration in production Supabase.
5. Bump app semver; do not delete the lab until the owner says so.
