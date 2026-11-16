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
| [Shared Arcadia runtime](./decisions/20261112-shared-arcadia-runtime.md) | Full-turn sandbox adapter, single chat host, presence lifecycle |
| Sandbox | [`/sandbox/aion`](../../app/sandbox/aion/) — first shipping surface |

## Structure

```
app/sandbox/aion/page.tsx
└── AionPresenceProvider
    ├── AdaptiveOrganicPresence (orb phase)
    ├── AionEventBench (lab triggers)
    ├── AionPresenceHud (cost / tier drawer)
    └── ArcadiaPersistentHost → AionChat → shared Chat → /api/chat (full turns)
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
| Sandbox full chat | `components/chat/aionChat.tsx` (surface adapter), `components/chat/chat.tsx`, `app/api/chat/route.ts` |
| Sandbox identity | `lib/system-prompt/aion-sandbox.ts` |
| Legacy full route | `app/api/ai/aion/route.ts`, `lib/api/aion-handler.ts` (retained for existing callers) |
| Prompt | `lib/system-prompt/aion-presence.ts` |
| Budget | `lib/rate-limit/aion-presence.ts` |
| Thread resolver | `lib/chat/resolve-feature-thread.ts` (`feature: "aion"`) |
| Preamble | `lib/llm/session-context.ts` |

## Turn tiers

| Tier | When | Cost |
|------|------|------|
| **0 — none** | Hover/scroll noise, coalesced bursts, busy, disabled | Free — ledger only |
| **1 — micro** | Most UI events after debounce | Cheap model, no tools, `generateText`, ~120 max out |
| **2 — full** | `kind: "message"` (composer or "Ask Aion") | Shared `/api/chat` Arcadia streaming + tools |

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
- Micro-turn rows are stamped `metadata.source = "aion-presence"`; full turns use the shared chat persistence path.

## Voice bridge (stretch)

When Speak Realtime is connected, `useRealtimeVoice.sendTextEvent` injects
`conversation.item.create` (`input_text`) + `response.create` on the data channel so a
UI event can get a spoken reply without a second model connection. The sandbox provider
routes micro-tier events there when a bridge is registered.

## Working on Aion presence

1. Read this file and the [ADR](./decisions/20260921-presence-layer.md).
2. Exercise `/sandbox/aion` — use **Burst 20 clicks** and the presence HUD.
3. Record decisions per the [maintenance protocol](../hub/maintenance-protocol.md).

## Sandbox runtime

The `aion` experience preserves the surface identity and composer settings scope. At the
client and `/api/chat` entry points it selects Arcadia's runtime, so model/effort controls,
context budgeting and condensation, generated UI, diagrams, memory, connected tools and
multiagent orchestration follow the same implementation and existing gates. Aion-specific
identity and archetype tools are added only to orchestrator turns.

The responsive shell keeps one Chat mounted. The event bench is collapsible; awareness can
be paused, and the diagnostics drawer reports micro-turn budgets and routing decisions.
Those counters are **micro-turn counters**, not the total cost of full chats and workers.
The shared plan budget and usage tracking cover full turns separately.

Typed chat cancels pending ambient work. Failed micro-turns retain their event ledger and
show an error; successful responses acknowledge only the events they consumed. Memory
load failures offer explicitly labelled sample data instead of silently displaying fixtures.

The existing Cmd+K launcher remains a navigation/semantic-routing palette. This sandbox
does not install a global conversational presence or resolve cross-surface continuity.
Voice awareness through shared Chat follows the existing voice session; the separate
micro-event voice bridge above still requires explicit registration.
