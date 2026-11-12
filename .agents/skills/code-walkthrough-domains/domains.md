# Organic LLM — walkthrough domain maps

Entry points and suggested read orders. Verify paths still exist before citing; this file is a seed, not a guarantee.

## Cross-cutting spine (main chat)

```
CoreInput → chat.tsx transport → app/api/chat/route.ts
  → chat-turn-context → compileChatTools → runLLMChatStream
  → tool parts (e.g. gather_* + render_gen_ui)
  → chat-message.tsx → GenUIRenderer / block components
```

Rabbit hole branching is **parallel** under `lib/rabbit-holes/`, not through the composer.

---

## 1. Chat (frontend)

**Spine:** page load → `useChat` shell → thread → per-message render → submit via CoreInput

| Priority | Path |
|----------|------|
| 1 | `app/chat/[slug]/page.tsx` |
| 2 | `components/chat/chat.tsx` |
| 3 | `components/chat/chat-thread.tsx` |
| 4 | `components/chat/chat-message.tsx` |
| 5 | `lib/chat/chat-store.ts` |
| 6 | `app/api/chat/[id]/stream/route.ts` (resume) |
| alt | `components/chat/aionChat.tsx` (Aion persona shell) |

**Walkthrough order:** page → `chat.tsx` → thread → `chat-message.tsx` → handoff to `app/api/chat/route.ts`.

---

## 2. Tool compilation / gen-ui

**Spine:** compile tools → model calls `render_gen_ui` → stream parts → registry → React block

| Priority | Path |
|----------|------|
| 1 | `lib/llm/compile-chat-tools.ts` |
| 2 | `lib/llm/gen-ui-tool.ts` |
| 3 | `lib/schemas/gen-ui/index.ts` |
| 4 | `lib/system-prompt/gen-ui.ts` |
| 5 | `components/chat/gen-ui/registry.tsx` |
| 6 | `components/chat/gen-ui/GenUIRenderer.tsx` |
| 7 | `components/chat/gen-ui/GenUIStreamingPart.tsx` |
| 8 | `components/chat/gen-ui/GenUIToolResult.tsx` |

**Walkthrough order:** compile → gen-ui-tool → schemas → registry → renderer → `chat-message.tsx` gen-ui branches.

---

## 3. Restaurant tool (example vertical slice)

**Spine:** `gather_restaurant` (data) → block assembly → `render_gen_ui` → `RestaurantCard`

| Priority | Path |
|----------|------|
| 1 | `lib/llm/restaurant-tool.ts` |
| 2 | `lib/restaurant/gather-restaurant.ts` |
| 3 | `lib/restaurant/gather-venue.ts` |
| 4 | `lib/restaurant/assemble-card.ts` |
| 5 | `lib/schemas/gen-ui/restaurant-card.ts` |
| 6 | `lib/system-prompt/restaurant.ts` |
| 7 | `components/chat/gen-ui/blocks/restaurant-card/RestaurantCard.tsx` |
| 8 | `components/chat/gen-ui/blocks/restaurant-card/RestaurantCardCondensed.tsx` |

**Walkthrough order:** tool → gather orchestrator → assemble → schema → card UI → `chat-message.tsx` gather/render branches.

---

## 4. Rabbit hole branching (“Chronos”)

**Spine:** schedule generation → multi-step persist loop → branch suggestions → user follows branch → child node

| Priority | Path |
|----------|------|
| 1 | `lib/schemas/rabbitHoleSchemas.ts` |
| 2 | `lib/rabbit-holes/scheduleNodeGeneration.ts` |
| 3 | `lib/rabbit-holes/runGenerationAndPersist.ts` |
| 4 | `lib/rabbit-holes/actions.ts` |
| 5 | `lib/llm/rabbit-hole/generation.ts` |
| 6 | `data/supabase/rabbitholes.ts` |
| 7 | `app/rabbitholes/_components/RabbitHoleBranchGrid.tsx` |
| note | Prefer `lib/rabbit-holes/useRabbitHoles.ts` over deprecated `app/rabbitholes/_lib/useRabbitHoleSession.ts` |

**Walkthrough order:** schemas → schedule → runGenerationAndPersist → actions → generation LLM → branch UI.

---

## 5. CoreInput backend (chat request path)

**Spine:** validated POST body → turn context → tools → stream

No dedicated CoreInput API — composer fields ride on chat POST.

| Priority | Path |
|----------|------|
| 1 | `lib/schemas/chat.ts` (`ChatRequestSchema`) |
| 2 | `app/api/chat/route.ts` |
| 3 | `lib/api/chat-turn-context.ts` |
| 4 | `lib/llm/compile-chat-tools.ts` |
| 5 | `lib/api/run-llm-chat-stream.ts` |

**Aion orchestrator (separate):** `hooks/use-aion.tsx` → `app/api/ai/core/route.ts` → `lib/llm/core/coreToolKit.ts`

**Walkthrough order:** schema → route → turn context → compile tools → stream runner.

---

## 6. CoreInput frontend

**Spine:** parent refs in `chat.tsx` ← CoreInput toggles/prefs → `prepareSendMessagesRequest` body

| Priority | Path |
|----------|------|
| 1 | `components/chat/chat.tsx` (refs + send prep) |
| 2 | `components/chat/core-input/core-input.tsx` |
| 3 | `components/chat/core-input/core-input-context.tsx` |
| 4 | `components/chat/core-input/controls/tool-toggle-group.tsx` |
| 5 | `components/chat/core-input/controls/model-effort-select.tsx` |
| 6 | `lib/chat/composer-tool-defaults.ts` |
| 7 | `hooks/use-composer-draft.ts` + `lib/chat/composer-draft-store.ts` |

**Walkthrough order:** `chat.tsx` contract → `core-input.tsx` → context → controls → defaults/drafts.
