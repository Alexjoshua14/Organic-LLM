# Noesis AI-infra (`lib/sandbox/noesis/`)

Internal (admin-only) infrastructure for **authored Noesis sparks** and the **prompt demo engine**. Noesis is the `topic_explore` sandbox experience.

## What lives here

```
sparks/
  types.ts       NoesisSpark type
  registry.ts    NOESIS_SPARKS[] — the authored sparks (add new ones here)
demo/
  types.ts       DemoTurn, DemoUsage + usage math (emptyDemoUsage / addUsage)
  config.ts      Tuning knobs (default model, token budget, reply cycles, caps)
  version.ts     computeDemoVersionHash() — content-addressed cache key  [server-only]
  npc.ts         NPC "main character" user simulator + persona prompt      [server-only]
  cache.ts       JSON-file demo-thread cache (get/put)                     [server-only]
```

## Two paths, one registry

1. **Production tap** — a user taps an authored spark in the Noesis empty state. The
   spark's `systemPrompt` is sent to `/api/chat` as `customSystemPromptOverride` and
   drives their real thread (true system-prompt override for `topic_explore`).
2. **Admin demo** — hover a spark → pencil → editor → **Demo**. An isolated overlay
   auto-runs `DEMO_REPLY_CYCLES` spark replies against the NPC simulator through the
   dedicated **`/api/sandbox/topic-explore/demo-turn`** route (no persistence, memory,
   or title generation), under `DEMO_TOKEN_BUDGET`. Results are cached by version hash.

## Demo caching (content-addressed)

`computeDemoVersionHash({ systemPrompt, kickoff, model, cycles, npcPersonaVersion })`
produces a SHA-256 key. Identical inputs → same key → cache hit. So editing a prompt
regenerates; reverting to (or re-typing) a previous version reuses the cached thread
for free. Cache is a JSON file at `data/noesis/demo-cache.json` (gitignored).

> **Why not `bun:sqlite`?** Next.js serves under Node (`next start` / `next dev`), where
> the Bun-only `bun:sqlite` builtin isn't available. The JSON file keeps the same intent
> (local, zero-infra, persistent, no migration) while staying Node-safe.

## Adding a spark

1. Append a `NoesisSpark` to `sparks/registry.ts`.
2. Document it in `docs/noesis-sparks.md` (user-facing text ↔ system prompt ↔ kickoff).
3. If you change the NPC persona in `demo/npc.ts`, bump `NPC_PERSONA_VERSION` to
   invalidate stale cached demos.

## Tuning knobs (`demo/config.ts`)

| Constant | Meaning |
|---|---|
| `DEMO_DEFAULT_MODEL` | Default ultracheap model (swappable live via CoreInput) |
| `DEMO_TOKEN_BUDGET` | Hard token ceiling per demo run |
| `DEMO_REPLY_CYCLES` | Spark replies per run (kickoff→reply, then NPC→reply ×2) |
| `DEMO_MAX_OUTPUT_TOKENS_PER_TURN` | Per spark-reply output cap |
| `DEMO_NPC_MAX_OUTPUT_TOKENS` | Per NPC-turn output cap |
