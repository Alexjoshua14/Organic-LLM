# Aion presence as a client layer with tiered turns

**Status:** Accepted — sandbox first slice
**Date:** 2026-09-21
**Affects:** `app/sandbox/aion/*`, `lib/aion/presence/*`, `lib/api/aion-event-handler.ts`,
`app/api/ai/aion/event/route.ts`, `lib/chat/resolve-feature-thread.ts`,
`lib/llm/session-context.ts`, `lib/rate-limit/aion-presence.ts`, `hooks/use-realtime-voice.ts`

## Context

A realtime voice agent feels present because the session is already open, it reacts to
events, it acknowledges fast, and it remembers what just happened. None of that requires a
persistent model connection for text/UI — cost is per turn. Today "Aion" is three
disconnected surfaces (`/api/ai/aion`, `/api/ai/core`, Speak Realtime). Speak already built
reusable pieces: feature-tagged threads, token-capped resume preamble, Redis budgets, and
turn persistence with `metadata.source`.

## Decision

Ship **presence as a client layer** over one continuous Aion thread:

1. **Typed event bus** on the client (`emitAionEvent`) with a ring-buffer ledger.
2. **Pure turn policy** that maps each event to tier `none` | `micro` | `full` with debounce,
   coalesce, busy, and idle-dormancy rules. Timing constants live next to the policy.
3. **Micro-turn route** `POST /api/ai/aion/event` — cheap model (`openai/gpt-oss-20b` by
   default), no tools, non-streaming `generateText`, `[silent]` contract, hard per-user
   budgets (RPM + daily turns + daily USD).
4. **Full turns** stay on the existing `createAionHandler` path; optional `trigger` is
   stamped on the request body for observability.
5. **Thread** tagged `feature: "aion"` via generalized `resolveFeatureThread` (Speak becomes
   a thin wrapper). Preamble via generalized `loadSessionContext` / `formatSessionContext`.
6. **First surface:** `/sandbox/aion` with orb, event bench, and cost HUD. Not app-wide yet.

### Rejected

- **Always-on Realtime session for text.** Would bill context continuously; presence does not
  need duplex audio for UI events.
- **Full chat turn per event.** Would blow the message RPM and $ budgets on button spam.
- **Server-side event bus.** Events originate in the browser; a server bus adds latency and
  another always-on connection without improving continuity (the thread already persists).

## Consequences

- Speak's resolver and session-context modules become thin wrappers; Speak tests stay green.
- `AdaptiveOrganicPresence` gets its first real mount (previously docs-only).
- Presence spend is visible in the sandbox HUD and in `llm_usage_events` (`aion-presence`).
- Product-intent defaults (budget numbers, which event kinds deserve a reply, promotion to
  chat/app-wide) remain open — see below.

## Open (private hub when available)

Record in `organic-llm-hub/aion/` when that repo is cloned; until then these stay open here:

- Final budget defaults (`PER_MINUTE`, `DAILY_TURN`, `DAILY_COST_USD`).
- Whether micro-turn replies are ever spoken outside Speak.
- One global Aion thread vs per-surface threads.
- Which event kinds deserve a reply vs ledger-only (beyond the current hover/scroll heuristic).
- Promotion criteria from sandbox → main chat → app-wide layout.

## See also

- [Aion README](../README.md)
- [Speak continuity ADR](../../speak/decisions/20260917-voice-continuity-and-memory.md)
- [Organic presence](../../organic-presence.md)
