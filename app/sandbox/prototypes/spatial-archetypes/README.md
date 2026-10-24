# Spatial Archetypes Browser

Sandbox prototype at `/sandbox/prototypes/spatial-archetypes` — a spatial library for revisiting **gen-ui** blocks (`render_gen_ui`) from your chat threads.

## Requirements

1. **Coalescence Mode** must be **on** (Settings → Coalescence Mode). When off, sync, pin, and the browser UI are disabled.
2. Apply [`docs/spatial-artifacts-schema.sql`](../../../docs/spatial-artifacts-schema.sql) in Supabase before first use.
3. Optional: set `CRON_SECRET` and schedule `GET /api/cron/sync-spatial-artifacts` for stale row reconcile.

## Features

- **Hybrid Supabase sync** — pointer + cached `GenUIBlock` snapshot; messages remain source of truth.
- **Pin from chat** — Bookmark button on gen-ui blocks (when Coalescence Mode is on).
- **Three zones** (type-routed, one artifact id → one zone):
  - **Plans** — condensed cards, click to expand (`?artifact=id&expand=1` deep links).
  - **Guides (Bookshelf)** — spine + hover-open bookshelf metaphor.
  - **Audio rack** — hover/tap TTS preview via global dock.
- **Spatial engine** — singleton `FloatingArtifact` per id; slot ghosts measure targets; morph physics shell.

## Sync triggers

| Trigger | When |
|---------|------|
| Pin | High-priority upsert |
| Chat finish | New `render_gen_ui` in saved assistant message |
| Page visit | Debounced bulk scan (30 threads) |
| Cron | Stale rows batch reconcile |

Rate limits: Upstash per-user + in-process semaphore (max 3 concurrent writes).

## Human handoff

See the plan **Section 9** for Supabase apply steps, spring tuning, and what to send back after manual code.

## Promotion path

Code is structured for later move to `/library/archetypes` — swap route + nav; core libs under `lib/spatial-artifacts/` stay unchanged.
