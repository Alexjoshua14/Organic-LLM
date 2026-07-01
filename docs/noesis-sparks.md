# Noesis Sparks — Internal Catalog (admin-only)

> **Not user-facing.** This is the working catalog for authored Noesis sparks: each entry
> pairs the user-facing text with its actual system prompt, so the prompts can be
> inspected, dissected, and improved. Keep this file in sync with
> `lib/sandbox/noesis/sparks/registry.ts` whenever a spark is added or edited.

## What is a spark?

A **spark** is a curated starter flow surfaced in Noesis (the `topic_explore` experience).
Authored sparks (this catalog) are distinct from the ephemeral, LLM-generated sparks from
`app/api/sandbox/topic-explore/starters/route.ts`. Each authored spark has:

- **User-facing text** — the tappable label shown to the end user.
- **System prompt** — the real prompt that drives the thread (applied as a system-prompt
  override on `topic_explore` when the spark is tapped).
- **Demo kickoff** — a preset opening user message used to seed admin demo runs.

## How it works end to end

- **Production tap:** tapping a spark sends `customSystemPromptOverride` (the spark's system
  prompt) to `/api/chat`; `appendTopicExploreCustomSystemPrompt` prepends it as an
  authoritative directive that governs the thread.
- **Admin demo:** hover a spark → **pencil** (bottom-right), or **long-press** on touch →
  editor → **Demo**. The demo runs **in the same modal pane** (swap-views): clicking **Demo**
  replaces the editor with a **condensed** transcript (compact role-labeled rows — `you` /
  `spark`, NPC turns marked `you · npc` — not the full chat view); **← Edit** returns, **Re-run**
  replays. It auto-runs `DEMO_REPLY_CYCLES` (3) spark replies against an NPC "main character"
  user via `/api/sandbox/topic-explore/demo-turn` + `/npc-turn`, on the ultracheap model
  (`google/gemini-3-flash`, swappable via the panel's model select), under `DEMO_TOKEN_BUDGET`
  (25,000) tokens. Components: `components/sandbox/noesis/spark-editor-dialog.tsx` (two-mode) +
  `spark-demo-panel.tsx` (condensed runner).
- **Caching:** demos are cached by a SHA-256 of `{ systemPrompt, kickoff, model, cycles,
  npcPersonaVersion }`. Reverting a prompt to a previous version replays the cached thread
  for free. Cache: `data/noesis/demo-cache.json` (gitignored).

> ⚠️ **Bundling pitfall (do not reintroduce).** The demo route handlers call Clerk's `auth()`.
> A `"use client"` component must **never** import the server tuning-knobs module
> `lib/sandbox/noesis/demo/config.ts` — doing so makes Turbopack compile those handlers into the
> React-SSR layer, whose Clerk copy isn't wired to `clerkMiddleware()`, so every demo request
> 500s with *"auth() ... can't detect usage of clerkMiddleware()"*. The client imports the
> mirror `lib/sandbox/noesis/demo/config.client.ts` instead; a unit test asserts the two stay in
> sync. (This was the original "demo isn't working" bug.)

## Tuning knobs — `lib/sandbox/noesis/demo/config.ts`

| Constant | Value | Meaning |
|---|---|---|
| `DEMO_DEFAULT_MODEL` | `google/gemini-3-flash` | Default demo model (swappable live via CoreInput) |
| `DEMO_TOKEN_BUDGET` | `25_000` | Hard token ceiling per demo run |
| `DEMO_REPLY_CYCLES` | `3` | Spark replies per run |
| `DEMO_MAX_OUTPUT_TOKENS_PER_TURN` | `800` | Per spark-reply output cap |
| `DEMO_NPC_MAX_OUTPUT_TOKENS` | `200` | Per NPC-turn output cap |

## NPC "main character" persona — `lib/sandbox/noesis/demo/npc.ts`

Version: `npc-v1` (bump `NPC_PERSONA_VERSION` when the persona changes to invalidate cached demos).

```
You are role-playing a real human user exploring a topic in a chat app — the "main
character" standing in for the actual user. Reply in the first person AS the user, never as
the assistant.

Rules:
- Keep each message short and natural (1–3 sentences).
- Move the conversation forward: react honestly, ask a sharper follow-up, push back when you
  disagree, or follow a genuine tangent.
- Stay curious and a little skeptical — you are not easily satisfied by tidy answers.
- Never break character. Never mention being an AI, a model, or a simulation.
- Output ONLY your message text — no role label, no quotation marks, no stage directions.
```

## How to add a spark

1. Append a `NoesisSpark` to `lib/sandbox/noesis/sparks/registry.ts`.
2. Add a matching section to the catalog below.
3. If it needs its own kickoff, set `demoKickoff` (used to seed demos).

---

## Catalog

### 1. `pressure-test-belief` — "Pressure-test a belief I hold a little too comfortably"

- **id / slug:** `pressure-test-belief`
- **Created:** 2026-06-29
- **User-facing text:** Pressure-test a belief I hold a little too comfortably
- **Demo kickoff:** "I believe that being constantly reachable makes me a more reliable person — that's why I keep notifications on for everything."
- **Notes:** Seed example spark shipped with the feature. Demonstrates the steelman → probe → counter-case loop.

**System prompt:**

```
You are a rigorous, generous thinking partner. The user will name a belief they hold. Your
job is to pressure-test it — not to attack the person, but to stress the idea until it either
gets stronger or it cracks.

Method:
- First, restate their belief in its strongest, most charitable form (steelman it) so they
  feel understood.
- Then surface the load-bearing assumptions underneath it and probe the weakest one.
- Offer one concrete counter-case or disconfirming scenario they likely haven't considered.
- Keep each turn tight (2–4 short paragraphs). End every turn with exactly one focused
  question so the conversation keeps moving.
- Never be glib or contrarian for its own sake. The goal is clearer thinking, not winning.

Stay warm, direct, and intellectually honest.
```
