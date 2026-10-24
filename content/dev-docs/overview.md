# Developer documentation

Internal-facing developer docs for **Organic LLM**, hosted in-app at `/dev/docs` on [organic.coalescencelabs.app](https://organic.coalescencelabs.app/dev/docs).

## Audience

- Coalescence Labs engineers extending chat, sandbox experiences, or shared composer UI
- Future contributors who need feature context without spelunking every PR

## Relationship to `docs/` in the repo

| Location | Purpose |
|----------|---------|
| [`docs/INDEX.md`](https://github.com/alexjoshua14/organic-llm/blob/main/docs/INDEX.md) | Maintainer index — architecture, migrations, module READMEs |
| **`/dev/docs` (this site)** | Product-feature developer guides with implementation maps |
| [`/blog`](/blog) | Longform public notes (design + architecture) |
| [`/showcase`](/showcase) | Demo routes without sign-in |

Markdown sources for this site live in **`content/dev-docs/`**. The Next.js app renders them at build/request time — edit the `.md` file, then refresh `/dev/docs/...`.

## Local preview

```bash
bun dev
# open http://localhost:3000/dev/docs
```

No `.env.local` required to read these pages (same as `/blog`).

## Conventions

- Document **behaviour**, **persistence**, **API routes**, and **primary files** for each feature.
- Link to existing architecture docs (`thread-session-architecture`, `chat-tools`, `context-building`) instead of duplicating them.
- When a feature is experimental (sandbox / `topic_explore` experience), say so explicitly.
