# Current date is the last section of the system prompt

**Status:** Accepted
**Date:** 2026-09-12
**Affects:** `lib/system-prompt/current-date.ts`, `lib/chat/chat-store.ts`, and every route that passes a system string to `streamText`

## Context

`SYSTEM_PROMPT` and `PROMETHEUS_SYSTEM_PROMPT` carried a `{{currentDateTime}}` placeholder that
`getContext` filled with a fresh ISO timestamp. Prompt caches reuse only an exact prefix, so a
value that changes on every request invalidates everything after it. In Prometheus the
placeholder sat in the first paragraph, so none of the persona was reusable. In the default
prompt it sat at the end of the base instructions, ahead of tool instructions and guidance.

## Decision

The date is appended as the **last** section of the final system string, immediately before
`streamText`, by `appendCurrentDate()` in `lib/system-prompt/current-date.ts`:

```text
…response-length instructions

Additional Info:
The current date is 2026-09-12T15:30:00.000Z
```

- Base prompts and `getContext` carry no date and no placeholder.
- Each route calls `appendCurrentDate()` once, on the string it passes as `system`:
  `/api/chat`, `/api/ai/remy`, `/api/ai/aion`, `/api/chat/prometheus`, `/api/chat/spark`.
- `/api/chat/context-budget` appends it too, so the estimate matches a real turn.
- `/api/ai/core` already ends its prompt with the date and is unchanged.

## Consequences

- The date no longer breaks the prefix in front of it.
- The summary, retrieved memories, and counts still change per turn and sit ahead of tool
  instructions, guidance, and history. Those gain cache reuse only once the per-turn sections
  move too — a separate decision.
- A new route that builds its own system string must call `appendCurrentDate()` on its final
  string, or the model has no date.
- Never append to a module-level prompt variable (Spark route, `lib/llm/context.ts`). Those
  persist across requests, so dates would accumulate.
