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

## Code map

| Path | Role |
|------|------|
| `lib/jev-stage/` | Router, budgets, direct tools, respond/orchestrate streams, store, turn |
| `app/api/prototypes/jev-stage/` | GET bundle, POST NDJSON turn / reset, eval POST |
| `components/jev-stage/` | Hook + insight panel |
| `docs/migrations/jev_stage_turn_eval.sql` | Lean Supabase eval table |

## Insight panel

Desktop: sticky-note sized card (`w-64`, `max-h-80`). Mobile: collapsed chip → sheet.
Paged turns; message capped to two secondary lines; top-3 confidences + popover for the rest;
three-line glance for cost / latency / cache / per-model spend; thumbs + optional note.

## Confidence floor

`JEV_STAGE_CONFIDENCE_FLOOR = 0.55` in `lib/jev-stage/constants.ts`. Tunable; threshold research
is out of scope for this lab.

## Promote recipe (later)

1. Capture legacy Stage screenshots.
2. Point Stage’s turn path at `runJevStageTurn` (or merge namespaces).
3. Keep insight panel opt-in until product accepts it.
4. Run the eval migration in production Supabase.
5. Bump app semver; do not delete the lab until the owner says so.
