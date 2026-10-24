# Voice continuity and memory through the existing Realtime relay

**Status:** Accepted — thread default is provisional, see below
**Date:** 2026-09-17
**Affects:** `hooks/use-realtime-voice.ts`, `app/api/ai/speak/realtime/{session,transcript}/route.ts`,
`lib/speak/*`, `lib/llm/compile-speak-tools.ts`, `lib/system-prompt/speak-realtime.ts`

## Context

Speak Live connected a browser to OpenAI Realtime over WebRTC and did nothing with the
conversation afterwards. Turns were never written to the thread, the two thread-metadata
nanobots read an empty `messages` table, no memory reached the model, and each session
started cold. The [current-state audit](../current-realtime-setup.md) records that baseline.

The Realtime API keeps no state across sessions. OpenAI's
[conversation guide](https://developers.openai.com/api/docs/guides/realtime-conversations)
offers no resume; continuation means storing turns ourselves and carrying context into the next
session. Two channels exist for that: `instructions` at mint (server → OpenAI, never through the
browser) and `conversation.item.create` on the data channel after connect (role-structured, but
routed through the client). The session config also accepts
[`truncation`](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create)
with a `retention_ratio` that drops post-instruction items when the context fills and never the
instructions themselves.

Two code facts shaped the mechanism. The hook listened for the **beta** transcript events
(`response.audio_transcript.*`); the GA interface names them
`response.output_audio_transcript.*`. And the session route already accepted a `threadId`, so
resume needed a resolver, not new plumbing.

## Decision

Build the mechanism in layers that hold under any thread model, and isolate the one undecided
product choice behind a policy value.

| Layer | Mechanism | Owner |
|-------|-----------|-------|
| Events | Pure classifier accepting GA and beta names; reads `response.done.usage` | `lib/speak/realtime-events.ts` |
| Persistence | Hook buffers completed turns, posts them to `/transcript`; one idempotent upsert per turn | `lib/speak/voice-turns.ts`, `lib/speak/persist-voice-turns.ts` |
| Memory read | `search_memories` as a Realtime function tool through the existing tool relay | `compile-speak-tools.ts`, `execute-speak-tool.ts` |
| Bootstrap | On resume, summary + memories + last turns rendered into `instructions`, capped, with `retention_ratio` truncation | `lib/speak/speak-session-context.ts`, session route |
| Memory write | After each flushed exchange, `addLatestMessagesToMemoryForUser` on complete pairs only | `persist-voice-turns.ts` |
| Thread | `resolveSpeakThread(policy)`; Speak threads carry `feature: "speak"` | `lib/speak/resolve-speak-thread.ts` |

**Thread default — provisional.** `resume-latest`: a session continues the newest `speak` thread
and an explicit New starts another. Voice threads stay separate from text threads. This is a
shipping default so the mechanism can be used, not a resolution of the open continuity question;
the product-level record and what it leaves open live in the private hub
(`organic-llm-hub/decisions/20260917-speak-thread-model-provisional.md`).

**Rehydration goes through `instructions`, not the data channel.** Decrypted history never
transits the browser purely as a relay, and the preamble sits where truncation cannot reach it.
The cost is fidelity: turns arrive as text inside the prompt rather than as role-structured
items. Budget is `SPEAK_CONTEXT_MAX_TOKENS` (1.8k) because sessions are minutes long and the
prompt is re-read every turn.

**Memory is an opt-in per session**, sent by the client the way chat's composer sends `memory`,
and captured on the Redis session record so the tool gate and the ingest path read one value.

### Held constant

Transport (WebRTC, `oai-events`), the `modelResult` / `clientEffects` split, auth and budget
checks in the tool executor, and the locked [tool behaviour](../tool-behavior.md). The memory
tool follows principle 2 by showing a caption at call start and never speaking a lookup.

## Alternatives rejected

**Replaying turns with `conversation.item.create`.** Better turn modelling, but decrypted history
would pass through the client, and there is a reported issue with injected assistant-role items
being ignored. Revisit if summary-only recall proves too weak.

**Remote MCP tools for memory.** Realtime now executes
[MCP tools](https://developers.openai.com/api/docs/guides/realtime-mcp) itself, which would
remove the browser round-trip. It needs a public HTTPS endpoint with bearer auth, breaks the
`lib/memory/operations.ts` contract that identity is Clerk-resolved server-side, cannot return
`clientEffects`, and bypasses the per-session budget check. Worth an ADR when full tool parity
is on the table.

**Vercel AI SDK realtime.** `experimental_useRealtime` is WebSocket-via-Gateway, capped at 25
minutes, and needs a newer `ai` major. Direct WebRTC stays.

**One batch upsert per flush.** Every row in a statement shares the transaction timestamp and
`getMessages` orders by `created_at` alone, so a user/assistant pair could reload reversed.
Sequential single-row upserts cost one extra query per turn on batches of two to four rows.

## Consequences

- `update_thread_title` and `summarize_thread` now operate on real rows.
- `llm_usage_events.cost_usd` for Speak reflects provider token counts instead of zero; the
  wall-clock estimate remains the fallback when a heartbeat carries no usage.
- Speak threads list under coalescence mode only, because of the `feature` tag.
- Turn order is anchored to when an utterance began, not when its transcript arrived, since
  Realtime finalises user transcription asynchronously. A transcript that lands after the
  2.5 s flush debounce can still be inserted after the reply it preceded — acceptable for a
  first slice, and the reason the debounce is not shorter.
- The route response gained `resumed`, `threadTitle`, and `memoryEnabled`; older clients that
  send only `createThread` still work.

## See also

- [Speak README](../README.md) — session behaviour and code map
- [Current Realtime setup](../current-realtime-setup.md) — the audited baseline this changes
- [Tool behaviour](../tool-behavior.md) — locked acknowledgement rules the memory tool follows
- [Session-mint decision](./20260813-openai-sdk-session-mint.md) — why the mint uses the SDK
