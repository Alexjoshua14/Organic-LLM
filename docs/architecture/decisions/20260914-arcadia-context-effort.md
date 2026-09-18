# Arcadia context effort (beta)

**Status:** Accepted
**Date:** 2026-09-14
**Affects:** `lib/memory/context-effort.ts`, `lib/memory/query-planner.ts`, `lib/memory/arcadia-memory-phase.ts`, `lib/chat/chat-store.ts`, Arcadia composer + settings

## Context

Arcadia already rewrites the latest user turn into 1–3 Mem0 queries (`rewriteMemoryQuery`, 800 ms, overfetch 28 / inject 20). That path is untyped paraphrases, has a single latency budget, and does not inject the standing Settings profile. The 50k thread-history window is separate and must stay that size.

## Decision

Add an Arcadia-only **context effort** control that scales **user-memory compilation** (typed planner + Mem0 + optional compact profile), not history.

- The client sends `contextEffort: "instant" | "quick" | "heavy"` only when the beta setting is on, the experience is Arcadia, and Memory is on.
- Omitted field → today’s rewriter. Main chat and topic-explore keep that path.
- Instant skips the planner LLM so Mem0 can start immediately (raw user text, one search).
- Quick and Heavy fill typed slots (`entity`, `topic`, optional `preference`) instead of similar paraphrases. Preference is omitted unless the prompt is about format/detail; the standing portrait covers taste.
- Quick and Heavy fetch a compact profile tree in parallel with planning and inject it as `User portrait (from profile)` before retrieved memories.
- Each tier is a **hard deadline** around the Arcadia memory phase. Late work is dropped; the turn still proceeds.
- Token caps apply when formatting the portrait + memory bullets, not to chat history.

| Tier | Wall clock | Planner | Mem0 | Profile | Inject cap | Combined memory+profile token cap |
|------|------------|---------|------|---------|------------|-----------------------------------|
| instant | 250 ms | none | 1 search, overfetch 8 | skip | 5 | ~400 |
| quick (default when beta on) | 1 s | typed, ~350 ms | up to 3, overfetch 28 | compact | 20 | ~2,500 |
| heavy | 5 s | typed, ~1.2 s | 3 + optional second pass | richer compact | 36 | ~6,000 |

Heavy’s second pass runs only if remaining time > ~800 ms and the resolved entity is not already in the user sentence.

`search_memories` tool limits are unchanged in this slice.

## Consequences

- Context HUD memory estimates follow the tier’s combined token cap when `contextEffort` is present; omitted uses the legacy ~900 estimate.
- Inventory text names the effort tier and still states that counts are a sample, not the whole store.
- The beta switch lives in Quick settings and Settings → Experimental; the composer slider appears only for Arcadia + Memory + beta.
