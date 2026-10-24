# Multitask Speak-to: distinct voices, silent progress, spoken milestones

**Status:** Accepted — sandbox first slice in Arcadia  
**Date:** 2026-09-25  
**Affects:** `app/sandbox/arcadia/_components/*`, `hooks/use-realtime-voice.ts`,
`components/voice/voice-session-provider.tsx`,
`app/api/ai/speak/realtime/{session,progress,milestone}/route.ts`,
`lib/schemas/speak-realtime-voice.ts`, `lib/schemas/speak-subagent-context.ts`,
`lib/speak/subagent-{progress,milestone}-item.ts`, `lib/arcadia/multitask/*`

## Context

Arcadia needs a user-accessible multitask shell where each subagent is a condensed main
character. The user can Speak to any of them. Product requirements:

1. Speak to starts a **new** Realtime session seeded with that agent's goal + progress.
2. While the agent works, **background progress** updates model context silently.
3. The model **announces only milestones**.
4. Each subagent has a **distinct Realtime voice id** (not style instructions), stable so
   the user can recognize them.

There is no production multi-agent runtime yet. The shell uses an honest sandbox roster.

## Decision

### 1. Distinct endpoints for silent vs spoken work events

| Endpoint | Kind | Client follow-up |
|----------|------|------------------|
| `POST /api/ai/speak/realtime/progress` | `{ kind: "progress", announce: false, body }` | `conversation.item.create` (system) — **no** `response.create` |
| `POST /api/ai/speak/realtime/milestone` | `{ kind: "milestone", announce: true, body }` | `conversation.item.create` (system) **then** `response.create` |

Screen ambient remains `POST /api/ai/speak/realtime/context` — different concern.

Prefaces live in `lib/speak/subagent-progress-item.ts` and
`lib/speak/subagent-milestone-item.ts` so the announce/silent contract is in the transcript.

### 2. Session mint accepts `voice` + `subagentSeed`

`POST /api/ai/speak/realtime/session` takes optional `voice` (OpenAI Realtime built-in) and
`subagentSeed` (identity, goal, progress, voice). Seed text is folded into instructions via
`formatSubagentSessionContext`. Default Speak Live still uses `alloy` when omitted.

### 3. Voice assignment is role-preset + uniqueness

`lib/arcadia/multitask/voice-assignment.ts` maps roles to preferred voice ids and reassigns
when two concurrent agents would collide, cycling only after the pool is exhausted. The
shell's Voice roster legend documents live assignments and presets.

### 4. Sandbox roster is the data source

`createDemoSubagents()` owns goal/progress/milestones/status. Demo ticks push into an open
Speak session bound to that agent. A production swarm would replace the roster, not the
Speak event contract.

## Consequences

- Ordinary `/speak` callers are unchanged (default voice, no seed).
- Arcadia mounts `ArcadiaMultitaskHost` on `/sandbox/arcadia/[slug]`.
- Open: whether subagent Speak threads should use a dedicated `threads.feature` tag (recorded
  in `docs/hub/open-questions.md`).
