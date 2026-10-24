# Aion — presence layer

Aion is Organic LLM's central intelligence. The **presence layer** makes it feel
present the way a realtime voice agent does: it reacts to events (not only typed
messages), keeps continued context on one thread, and stays cheap by default.

Product intent (scope, acceptance criteria, open direction) belongs in the private
hub at `organic-llm-hub/aion/` when that repo is cloned. This doc is the **public
operational** half: what exists, which files own what, and the cost controls.

| Doc | Holds |
|-----|-------|
| [Presence layer ADR](./decisions/20260921-presence-layer.md) | Why a client layer + tiered turns, not an always-on LLM |
| [Orchestrator / worker + identity](./decisions/20260925-orchestrator-worker-identity.md) | Runtime roles, 7s return budget, thought routing, identity marks |
| Sandbox | [`/sandbox/aion`](../../app/sandbox/aion/) — first shipping surface |

## Structure

```
app/sandbox/aion/page.tsx
└── AionPresenceProvider
    ├── AdaptiveOrganicPresence (orb phase)
    ├── AionEventBench (lab triggers)
    ├── AionPresenceHud (cost / tier drawer)
    └── AionChat → /api/ai/aion (full turns)
         micro-turns → /api/ai/aion/event
```

| Area | Path |
|------|------|
| Schemas | `lib/schemas/aion-presence.ts` |
| Event bus + ledger | `lib/aion/presence/event-bus.ts` |
| Turn policy | `lib/aion/presence/turn-policy.ts` |
| Persist | `lib/aion/presence/persist-turns.ts` |
| Micro-turn handler | `lib/api/aion-event-handler.ts` |
| Route | `app/api/ai/aion/event/route.ts` |
| Full chat (existing) | `app/api/ai/aion/route.ts`, `lib/api/aion-handler.ts` |
| Prompt | `lib/system-prompt/aion-presence.ts` |
| Budget | `lib/rate-limit/aion-presence.ts` |
| Thread resolver | `lib/chat/resolve-feature-thread.ts` (`feature: "aion"`) |
| Preamble | `lib/llm/session-context.ts` |

## Turn tiers

| Tier | When | Cost |
|------|------|------|
| **0 — none** | Hover/scroll noise, coalesced bursts, busy, disabled | Free — ledger only |
| **1 — micro** | Most UI events after debounce | Cheap model, no tools, `generateText`, ~120 max out |
| **2 — full** | `kind: "message"` (composer or "Ask Aion") | Existing `/api/ai/aion` streaming + tools |

The model may reply `[silent]` on a micro-turn; the client treats that as Tier 0 after the fact.

## Budget knobs (env)

| Env | Default | Effect |
|-----|---------|--------|
| `AION_PRESENCE_ENABLED` | on (unless `"false"`) | Kill switch |
| `AION_PRESENCE_PER_MINUTE_CAP` | `12` | Micro-turns / minute |
| `AION_PRESENCE_DAILY_TURN_CAP` | `200` | Micro-turns / day |
| `AION_PRESENCE_DAILY_COST_CAP_USD` | `1` | Soft daily $ cap |
| `AION_PRESENCE_MAX_OUTPUT_TOKENS` | `120` | Micro-turn output cap |

Every micro-turn also passes `checkLlmMessageLimit` and lands in `llm_usage_events` with
`operation: "aion-presence"`.

## Continuity

- One thread tagged `feature: "aion"`, policy `resume-latest` (provisional, same shape as Speak).
- Micro-turns load a token-capped preamble (summary + memories + last turns).
- Rows are stamped `metadata.source = "aion-presence"`.

## Voice bridge (stretch)

When Speak Realtime is connected, `useRealtimeVoice.sendTextEvent` injects
`conversation.item.create` (`input_text`) + `response.create` on the data channel so a
UI event can get a spoken reply without a second model connection. The sandbox provider
routes micro-tier events there when a bridge is registered.

## Working on Aion presence

1. Read this file and the [ADR](./decisions/20260921-presence-layer.md).
2. Exercise `/sandbox/aion` — use **Burst 20 clicks** and the presence HUD.
3. Record decisions per the [maintenance protocol](../hub/maintenance-protocol.md).
