# Documentation index

## Start here

- [Contributing](../CONTRIBUTING.md) — setup, code boundaries, pull requests
- [Thread & session architecture](./thread-session-architecture.md) — persistence, encryption, sidebar contract
- [Context building](./architecture/context-building.md) — how chat context is assembled before `streamText`
- [End-to-end encryption overview](./e2ee.md)

## Product & features

- [Chat tools](./chat-tools.md) — assistant toolbelt (memory, search, Gen UI, Mermaid, kanban, experiences)
- [Arcadia sandbox](./arcadia.md)
- [Chat LLM transparency](./chat-llm-transparency.md)
- [Export prompt presets](./export-prompt-presets.md)
- [Speak page architecture](./speak-page-architecture.md)

## Design & UI

- [Adaptive background](./adaptive-background.md)
- [Organic presence](./organic-presence.md)

## Blog (in-app)

Public routes under `/blog` — see the [blog index](../app/blog/page.tsx) or run locally and open `/blog`.

## Database

- [SQL migrations](./migrations/) — incremental schema snippets; not a full Supabase migration history. Apply in your own project as needed.

## Packages

- [`llm/`](../llm/README.md) — shippable libraries (`@organic-llm/morph-physics`)

## Codebase guides

| Area | README |
|------|--------|
| Memory layer | [`lib/memory/README.md`](../lib/memory/README.md) |
| LLM subagents | [`lib/llm/subagents/README.md`](../lib/llm/subagents/README.md) |
| Strata prototype | [`app/sandbox/prototypes/strata/README.md`](../app/sandbox/prototypes/strata/README.md) |
| Memory ingest prototype | [`app/sandbox/prototypes/memory-ingest/README.md`](../app/sandbox/prototypes/memory-ingest/README.md) |

## Maintainer notes

- [Strata manual verification](./strata-manual-verification.md)
- [TTS token tracker](./tts-token-tracker.md)
