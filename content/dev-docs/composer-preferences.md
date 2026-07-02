# Composer preferences & Auto model

The shared chat composer is **`CoreInput`** (`components/chat/core-input.tsx`). Parent components pass refs for model and tool toggles into the chat POST body.

## Defaults

Centralized in `lib/chat/composer-tool-defaults.ts`:

| Setting | Default | Notes |
|---------|---------|--------|
| **Search** | `true` | Web search tool when supported |
| **Memory** | `true` | Memory search / ingest flags on POST |
| **Model** | **Auto** | `organic-llm/auto` → server-side routing |

Override per surface with `defaultWebSearch`, `defaultMemories`, or `defaultModel` on `CoreInput`.

## Persistence (`localStorage`)

Prefs sync to the browser origin (host + port). Keys:

| Key | Value |
|-----|--------|
| `organic-llm-selected-model` | Gateway model id or `organic-llm/auto` |
| `organic-llm-web-search` | `"true"` / `"false"` |
| `organic-llm-memories` | `"true"` / `"false"` |
| `organic-llm-prefs-timestamp` | Unix ms; prefs expire after **24 hours** |

When expired, keys are cleared and **defaults** apply again.

Optional overrides:

- `modelLocalStorageKey` — e.g. Delphi ingest uses a separate model key
- `memoryLocalStorageKey` — introspection vs main chat

### Multi-window / side-by-side workflows

All tabs and windows on the **same origin** share one stored model and toggles. This is intentional for continuity but means parallel workflows on `localhost:3000` mirror the same selection (e.g. all show Opus if that was last saved).

**Mitigation today:** run another worktree on a **different port** (`bun run dev -- -p 3001`) for isolated `localStorage`.

**Future:** per-window session prefs or orchestration-scoped routing (see below).

## Auto model routing

When the selected model is **Auto** (`AUTO_CHAT_MODEL_ID`), the chat API resolves a concrete gateway model before `streamText`:

- Implementation: `lib/llm/auto-model-router.ts`
- Entry: `app/api/chat/route.ts` (and other routes that honour Auto)

Current v1 policy:

- **Reflex tier** — short, non-analytical prompts → cheaper/fast models (Haiku, Flash Lite, Nano when ZDR allows)
- **Reasoning tier** — long text or reasoning keywords → Sonnet-class (or Sonar when ZDR off)

ZDR (zero data retention) setting filters non-ZDR models when enabled.

### Roadmap (product direction)

Auto is a stepping stone toward:

1. **Premium selector** — cost-capable routing; do not default to the largest model when a cheaper model is equally capable
2. **Orchestration layer** — multiple LLM calls per user turn, not a single `streamText`
3. **Worker nodes** — subtasks routed to the ideal model per step

Document design decisions here as orchestration lands.

## Primary files

| Area | Path |
|------|------|
| Defaults | `lib/chat/composer-tool-defaults.ts` |
| Composer UI | `components/chat/core-input.tsx` |
| Auto router | `lib/llm/auto-model-router.ts` |
| Model schema | `lib/schemas/chat.ts` |
| Main chat POST | `app/api/chat/route.ts` |
| Tests | `tests/unit/composer-tool-defaults.test.ts`, `tests/unit/auto-model-router.test.ts` |

## Related docs

- [Noesis](/dev/docs/noesis) — topic explore composer options (`morphAssistComposer`, assist APIs)
- [Context building](https://github.com/alexjoshua14/organic-llm/blob/main/docs/architecture/context-building.md)
- [Chat message flow](/blog/chat-message-flow)
