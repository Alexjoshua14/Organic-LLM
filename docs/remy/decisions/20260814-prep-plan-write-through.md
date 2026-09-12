# Weekly prep uses Ergon-style write-through (`prep_plan`)

**Status:** Accepted
**Date:** 2026-08-14
**Affects:** `lib/llm/prep-plan-tool.ts`, `app/api/ai/remy/route.ts`, `components/remy/RemyChatDock.tsx`

## Context

Event meal planning (`mise_plan`) drives a client store over a transient `data-mise` channel and
also persists per **thread**. A weekly plan is not owned by a chat: the `/remy` dashboard and
`/remy/[id]` threads must read the same `prep_*` tables.

## Decision

Add `prep_plan` **alongside** `mise_plan` / `fetch_recipe` on `/api/ai/remy`. Persist first through
[`data/supabase/prep.ts`](../../../data/supabase/prep.ts) (same pattern as Ergon `manage_tasks`).
Do not emit a puppet channel. `fetch_recipe` stays extract-only; Remy then `UPSERT_RECIPE` into
the library.

The dashboard dock wraps existing `Chat` with `persona="remy"`. First open creates or resumes a
thread tagged `feature = remy_planner` (path `/remy/<id>`). Other Remy threads stay at `/remy/[id]`.

## Commands

`UPSERT_RECIPE`, `PLACE_MEAL`, `SET_LEFTOVER`, `CLEAR_SLOT`, `SET_INGREDIENT_STATUS`, `LIST_WEEK`,
`LIST_LIBRARY`.
