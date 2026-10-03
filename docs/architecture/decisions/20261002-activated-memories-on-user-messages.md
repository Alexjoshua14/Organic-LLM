# Activated memories stay on the user message that retrieved them

**Status:** Accepted
**Date:** 2026-10-02
**Affects:** `lib/chat/chat-store.ts`, `lib/memory/activated-thread-memories.ts`, `lib/memory/condense-activated-memories.ts`, `app/api/chat/route.ts`, `lib/message-queue/run-queued-chat-turn.ts`

## Context

`getContext` rebuilds the system prompt on every send. The "Memories from past conversations" section is only the memories retrieved for the current user text. The message list is prior thread messages, which did not store those retrievals. A memory fetched on turn N left the model window on turn N+1 unless the new query retrieved it again.

## Decision

The memories selected for a turn are stored on that user message as `data-activated-memories` (`{ id, text }[]`).

- The part is written after the optimistic `saveChat` insert, via `updateChatMessage`, on the original user message (not the diagram-augmented model copy).
- Before `convertToModelMessages`, a copy of the in-window messages appends those lines as text. Each memory id is included once, on the latest in-window user message that carries it.
- The persisted message does not gain that text part. The transcript renders text parts only, and Mem0 ingest reads text parts only.
- The system prompt still receives this turn's fresh retrieval. Those lines can appear twice on the turn they are fetched: once in the system section, once on the user message.
- `get_more_chat_history` includes the same block, so a lookback still shows memories after the activating message leaves the default window.
- No new table. Cap is 40 memories per message.
- Each stored memory is capped at 500 characters. `getContext` returns full text. The stamp clips longer memories at a sentence or word boundary, so the turn never waits on an LLM; the system prompt already has the full text for that turn. After the response (`after()`), up to 5 memories over the cap are condensed in parallel by GPT-6 Luna (forced ZDR, reasoning off, no retry) under one 3-second deadline, and the row is patched again. A failed, empty, or late call keeps the clip.

## Consequences

- Recently fetched memories remain in the chat window for as long as the user message that retrieved them stays in the window (default chat: latest 10 messages; Strata: 30; Arcadia: the 50k-token window).
- When that message scrolls out, the memory leaves with it unless a later turn retrieved it again.
- Token estimates count the block on each carrying message. The hard cap can count a memory twice when it is also in the system prompt for the current turn.
