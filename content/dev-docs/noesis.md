# Noesis (topic explore)

**Noesis** is the `topic_explore` chat experience: a single thread of thought with memory-informed starters, reply assist, and steer notes. Routes: `/sandbox/topic-explore`, `/sandbox/topic-explore/[slug]`.

## Experience flag

Chat POST bodies include `experience: "topic_explore"`. The server uses this for titling, feature captions, and experience-specific behaviour. See `lib/chat/thread-feature-caption.ts` (`topic_explore` → `"noesis"`).

## User-facing features

### Sparks (cold start)

- On an empty thread, four **starter prompts** load from `POST /api/sandbox/topic-explore/starters`.
- Starters use memory + exclude the current thread id.
- UI: `TopicExploreClient` empty state in `components/sandbox/topic-explore-client.tsx`.

### Suggest my reply

Drafts the user's **next message** (not an assistant reply) using transcript, optional thought profile, steer notes, and memory search.

| Action | Behaviour |
|--------|-----------|
| **Suggest my reply** | Calls assist API; fills composer (edit before send) |
| **Shift+click** or **Send suggestion** | Same API; sends immediately without editing |
| **Finish my reply** | When composer has partial text, assist completes the draft |

**Availability:** Enabled when the last message is from the assistant, chat status is `ready`, and a short debounce cooldown (1.5s) has passed after the previous assist. Cooldown resets when a new assistant turn completes.

**While generating:** Composer shows accent **shimmer** text; assist row shows “Drafting…”.

**Button chrome:** `variant="glass"` (smoke glass + backdrop blur).

**API:** `POST /api/sandbox/topic-explore/assist-reply`

Body fields:

- `lastTurns` — recent user/assistant text turns
- `thoughtProfile` — optional session profile
- `steerNotes` — optional steer panel output
- `composerDraft` — optional partial composer text to finish

Model: `TOPIC_EXPLORE_ASSIST_MODEL` in `lib/sandbox/topic-explore-llm.ts`.

### Steer assist

**Steer assist** (⌘/Ctrl+Enter or footer button) calls `POST /api/sandbox/topic-explore/steer` with the current composer text. Output is shown as **Steer notes (for assist)** and passed into assist-reply as constraints — not sent as a chat message.

### Thought profile

After each user message, `POST /api/sandbox/topic-explore/thought-profile` merges a lightweight session profile (debounced). Used by assist-reply for voice/stance.

### Composer morph (assist states)

When `morphAssistComposer` is set on `CoreInput`, the composer body springs between **edit** and **drafting** layouts via `@organic-llm/morph-physics`:

- `components/chat/composer-assist-morph-body.tsx`
- Ghost measurement + `useMorphPhysics` (same pattern as Strata source input and morph prototypes)

### Scroll persistence

Per-thread scroll position is stored in `localStorage` so refresh does not jump to the bottom.

- Key: `organic-llm-noesis-scroll:{threadId}`
- Snapshot: `{ scrollTop, isAtBottom, savedAt }` (30-day TTL)
- If `isAtBottom`, stick-to-bottom behaviour is preserved; if scrolled up, position is restored and auto-stick is escaped.
- `components/sandbox/noesis-scroll-persistence.tsx`
- `lib/sandbox/noesis-scroll-storage.ts`

`Conversation` uses `initial={false}` when restoring a mid-thread position.

### Thread title overlay

When the **sidebar is collapsed** on desktop, the thread title appears in a **glass pill** top-left above the conversation (`ChatThreadTitleOverlay`). Hidden on mobile and when the sidebar is open.

- `components/chat/chat-thread-title-overlay.tsx`
- Title from thread data + sidebar list (updates after `chat-title-generated`).

## Primary files

| Area | Path |
|------|------|
| Client shell | `components/sandbox/topic-explore-client.tsx` |
| Page | `app/sandbox/topic-explore/[slug]/page.tsx` |
| Assist API | `app/api/sandbox/topic-explore/assist-reply/route.ts` |
| Steer API | `app/api/sandbox/topic-explore/steer/route.ts` |
| Starters API | `app/api/sandbox/topic-explore/starters/route.ts` |
| Thought profile API | `app/api/sandbox/topic-explore/thought-profile/route.ts` |
| LLM constants | `lib/sandbox/topic-explore-llm.ts` |
| Scroll storage | `lib/sandbox/noesis-scroll-storage.ts` |
| Shared composer | `components/chat/core-input.tsx` |

## Tests

- `tests/unit/noesis-scroll-storage.test.ts`

## Related docs

- [Composer preferences](/dev/docs/composer-preferences) — Search/Memory defaults used by Noesis composer
- [Chat tools](https://github.com/alexjoshua14/organic-llm/blob/main/docs/chat-tools.md) — shared toolbelt
- [Morph physics package](https://github.com/alexjoshua14/organic-llm/blob/main/llm/README.md) — `@organic-llm/morph-physics`

## Local dev (second instance)

Run a worktree on another port to avoid clashing with a main dev server:

```bash
bun run dev -- -p 3001
```

Composer prefs are per-origin (`localhost:3000` vs `:3001` are separate).
