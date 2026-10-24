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

## Model catalog (`models` vs picker)

App code should import `models` from `lib/schemas/chat-models.ts` (re-exported from `lib/schemas/chat.ts`) and pass `models.provider.family.id` to the gateway (for example `models.openai.luna.id`). Aliases are a **developer index**, not a picker option and not what we persist.

The composer lists `ChatModels` (Auto + rows with `picker !== false`) and displays each row’s `name`. `localStorage` and `ChatRequest.model.id` stay gateway ids (or `organic-llm/auto`). Message badges resolve the stored id via `getModelDisplayName`.

To upgrade a family, change that catalog row’s `id` / `name` and leave `alias` in place. See [`docs/architecture/decisions/20260909-chat-model-aliases.md`](https://github.com/alexjoshua14/organic-llm/blob/main/docs/architecture/decisions/20260909-chat-model-aliases.md).

## Persistence (`localStorage`)

These global keys are the **legacy prefs**. Every CoreInput without a `snapshotScope` still
uses them, and scoped composers fall back to them (see
[Per-scope snapshots](#per-scope-snapshots)). Prefs sync to the browser origin (host + port).
Keys:

| Key | Value |
|-----|--------|
| `organic-llm-selected-model` | Gateway model id or `organic-llm/auto` |
| `organic-llm-web-search` | `"true"` / `"false"` |
| `organic-llm-memories` | `"true"` / `"false"` |
| `organic-llm-prefs-timestamp` | Unix ms; prefs expire after **24 hours** |

When expired, keys are cleared and **defaults** apply again. Expiry counts from the last visit:
each load refreshes the timestamp.

Optional overrides:

- `modelLocalStorageKey` — e.g. Delphi ingest uses a separate model key
- `memoryLocalStorageKey` — introspection vs main chat

### Multi-window / side-by-side workflows

All tabs and windows on the **same origin** share one stored model and toggles. This is intentional for continuity but means parallel workflows on `localhost:3000` mirror the same selection (e.g. all show Opus if that was last saved).

**Mitigation today:** run another worktree on a **different port** (`bun run dev -- -p 3001`) for isolated `localStorage`.

Per-scope snapshots remove most of this for chat threads: each thread remembers its own
settings, so two tabs on two threads no longer fight. Areas and the legacy keys are still
shared per origin.

## Per-scope snapshots

A scoped CoreInput remembers its settings per **scope**: one thread, one area, or a `/btw`
side thread. A snapshot holds model, effort, context effort, web search, memory, and speech
(`CoreInputSettings` in `lib/core-input/settings.ts`). Markdown preview is not included,
because it describes the draft rather than the turn.

| Surface | Scope key | Inherits from |
|---------|-----------|---------------|
| Chat threads (Arcadia, Remy, …) | `<area>:thread:<id>` | `<area>`, then legacy prefs |
| Aion | `aion:thread:<id>` | `aion`, then legacy prefs |
| Introspection | `introspection:thread:<id>` | `introspection`, then legacy prefs |
| Rabbit Holes prompt bar | `rabbit-holes` | legacy prefs |
| `/btw` side thread | `btw:<thread id>` (in memory only) | its thread, then the area |
| Strata assistant, sandbox labs | none | legacy prefs only |

**Writes happen only on user changes, never on view.** A change writes the scope, each
`writeThrough` key, and the legacy prefs. A thread writes through to its area, so a new thread
starts from the last settings used anywhere in that area. Hydration, morph steps, the
effort clamp, and the admin-model downgrade apply settings without saving them.

### Encoding: 128 bits per entry

`lib/core-input/snapshot-codec.ts` packs each entry into two integers below 2^53:

- **Key:** a cyrb53 hash of the scope key (53 bits).
- **Value:** 37 bits holding a 4-bit codec version, effort (3 bits), context effort (2 bits),
  three toggle bits, one reserved bit, and a 24-bit hash of the model id.

The model is stored as a hash rather than a registry index, so reordering or removing models
never remaps stored snapshots. `tests/unit/core-input-snapshot-codec.test.ts` asserts that no
two registry models share a hash. If a stored model has left the registry, the scope keeps its
other settings and takes the model from the fallback.

Both numbers survive JSON, Postgres `bigint`, and `Float64Array` exactly, with no BigInt
anywhere.

### Cache and collisions

`CoreInputSnapshotStore` (`lib/core-input/snapshot-store.ts`) keeps at most **4,096**
entries. That is 64 KiB of binary, about 87 KB base64'd under
`organic-llm-core-input-snapshots`.

Recency is free: the store is an insertion-ordered `Map`, reads and writes move an entry to
the end, and eviction drops the first entry. A lookup is one `Map.get`. There is no Bloom
filter in front: one only helps when a negative answer saves a slow read, and here both hits
and misses are answered in memory.

With 4,096 keys in a 53-bit space, the chance that any two collide is about 1e-9. A collision
could only make two scopes share settings on one device. The server stores full scope keys,
so a collision never syncs.

### Supabase sync

Migration: `docs/migrations/core_input_snapshots.sql`. Route: `app/api/core-input/snapshots`.
Client: `lib/core-input/snapshot-sync.ts`.

- **Pull:** once per page load. Server rows merge in unless a newer local write has not synced
  yet.
- **Push:** pending writes are tracked by full scope key and persisted under
  `organic-llm-core-input-snapshots-pending`. They are pushed 5s after the last change and
  on page hide, in batches of up to 256.
- **Conflicts:** last write wins by client timestamp. The server drops rows older than what it
  holds and prunes each user to 4,096 rows.
- **Failure:** a 401, 404, or 503 (table not migrated yet) turns sync off for the page; the
  device keeps working from its local cache.
- **Late pulls:** a pull that lands after mount re-morphs the visible scope, unless the user
  has already changed something there.

The sync route never calls a model, so it skips `requireLlmChatActor` and does not spend the
user's LLM message limit.

Morph timing and interruption rules: [CoreInput snapshot morph](https://github.com/alexjoshua14/organic-llm/blob/main/docs/design/core-input-morph.md).

## `/btw` side questions (Arcadia)

Typing `/btw <question>` in an Arcadia thread opens a side thread docked above CoreInput.
`/btw` with no question opens it empty. Slash commands bypass the busy-stream gate, so a side
question works while the main thread is still answering.

While the side thread is open:

- CoreInput sends to `POST /api/chat/[id]/btw`. Its status, stop, and errors follow the side
  thread, and drafts are not saved to the main thread.
- CoreInput switches to the ephemeral `btw:<thread id>` scope, seeded from the thread's
  settings. Changes made there never reach the cache, Supabase, or the legacy prefs.
- **Close** (✕ or Esc) stops any stream, drops the exchange, and morphs CoreInput back to the
  thread's snapshot.

The route answers from a compact, text-only snapshot (`lib/chat/btw-context.ts`), not the
full turn:

- the thread summary, capped at 1,200 tokens;
- the most recent turns that fit in 3,000 tokens, each capped at 800 and always including the
  latest exchange;
- no tools, no memory retrieval, and nothing persisted.

Auth, plan budget, owner check, admin-only model fallback, ZDR, and gateway attribution
(`op:btw`) match the main chat route.

## Auto model routing

When the selected model is **Auto** (`AUTO_CHAT_MODEL_ID`), the chat API resolves a concrete gateway model before `streamText`:

- Implementation: `lib/llm/auto-model-router.ts`
- Entry: `app/api/chat/route.ts` (and other routes that honour Auto)

Current v1 policy (families via `models` in `lib/llm/auto-model-router.ts`):

- **Reflex tier** — short, non-analytical prompts → cheaper/fast models (Flash Lite, Haiku, Luna)
- **Reasoning tier** — long text or reasoning keywords → Opus / Flash / Sol (Sonar when ZDR is off)

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
| Composer UI | `components/chat/core-input/core-input.tsx` |
| Snapshots | `lib/core-input/` (codec, store, sync, scopes, morph), `app/api/core-input/snapshots/route.ts` |
| `/btw` | `hooks/use-btw-session.ts`, `components/chat/btw/btw-panel.tsx`, `app/api/chat/[id]/btw/route.ts`, `lib/api/run-btw-stream.ts`, `lib/chat/btw-context.ts` |
| Auto router | `lib/llm/auto-model-router.ts` |
| Model catalog | `lib/schemas/chat-models.ts` (re-exported from `lib/schemas/chat.ts`) |
| Main chat POST | `app/api/chat/route.ts` |
| Tests | `tests/unit/composer-tool-defaults.test.ts`, `tests/unit/auto-model-router.test.ts`, `tests/unit/chat-models.test.ts`, `tests/unit/core-input-snapshot-*.test.ts`, `tests/unit/core-input-morph-timeline.test.ts`, `tests/unit/btw-context.test.ts`, `tests/integration/btw-route.test.ts`, `tests/integration/core-input-lab.test.tsx` |

## Related docs

- [Noesis](/dev/docs/noesis) — topic explore composer options (`morphAssistComposer`, assist APIs)
- [Context building](https://github.com/alexjoshua14/organic-llm/blob/main/docs/architecture/context-building.md)
- [Chat message flow](/blog/chat-message-flow)
