# Contributing to Organic LLM

Thanks for your interest. Organic LLM is a full-stack AI app and design lab — chat, memory, rabbit-hole research, sandbox experiments, and shippable packages under `llm/`.

## Explore first (no API keys)

The fastest way to understand the product:

- **Hosted app** — [organic.coalescencelabs.app](https://organic.coalescencelabs.app)
- **Local preview** — after `bun dev`, open `/showcase`, `/blog`, or `/good-news?preview=1` (no `.env.local` required)

Signed-in flows (`/chat`, `/rabbitholes`, `/sandbox`) need Clerk, Supabase, and optional AI/memory services — see [README — Running locally](./README.md#running-locally).

## Prerequisites

- **Node.js** ≥ 20
- **[Bun](https://bun.sh)** (package manager and test runner)

## Setup

```bash
git clone https://github.com/alexjoshua14/organic-llm.git
cd organic-llm
bun install
```

For the full stack locally:

```bash
cp .env.example .env.local
# Fill in Clerk, Supabase, and any optional keys you need — names only in .env.example
bun dev
```

Schema snippets live in [`docs/migrations/`](./docs/migrations/). Regenerate Supabase types with `bun run supabase:types` after `supabase link`.

For Clerk profile sync on sign-up, run `bun run dev:full` (ngrok tunnel to `/api/webhooks/clerk`) — see [README — Running locally](./README.md#running-locally). Health checks: `/status` when env is configured.

## Development commands

```bash
bun run lint:check    # ESLint (CI-style; no auto-fix)
bun run lint          # ESLint with --fix
bun run test          # unit + integration (Bun)
bun run test:unit     # unit only
bun run test:integration
bun run test:e2e      # Playwright (E2E_CLERK_* for signed-in flows)
bun run build         # Next.js production build (also builds morph-physics)
```

CI runs tests on PRs to `main`; changes under `llm/morph-physics/` trigger a separate workflow.

## Where to read architecture

Start at **[docs/INDEX.md](./docs/INDEX.md)** — thread persistence, context assembly, chat tools, Arcadia, encryption, and module READMEs.

High-signal entry points:

| Topic | Doc |
|-------|-----|
| Chat context & summaries | [thread-session-architecture](./docs/thread-session-architecture.md), [context-building](./docs/architecture/context-building.md) |
| Assistant tools | [chat-tools](./docs/chat-tools.md) |
| Memory layer contract | [lib/memory/README.md](./lib/memory/README.md) |

## Code boundaries

Keep changes scoped and respect existing layers:

- **Memory** — App and UI code must use [`lib/memory/operations.ts`](./lib/memory/operations.ts), not [`lib/memory/store.ts`](./lib/memory/store.ts) directly. The store is server-only, no auth, no rate limits; operations enforce identity, limits, and schema validation.
- **Server-only** — Modules marked `server-only` (crypto, memory, many API helpers) must not be imported from client components.
- **Identity** — Resolve user ids on the server (Clerk → Supabase). Do not trust client-supplied `userId` except where explicitly validated (e.g. memory delete by id).
- **Sandbox** — Experiments under `app/sandbox/` may break; stable ideas should graduate into main routes or `/showcase`.

Match surrounding style: TypeScript, existing naming, minimal diffs. Run `bun run lint:check` and `bun run test` before opening a PR.

## Pull requests

1. Branch from **`develop`** (active integration branch).
2. Keep PRs focused — one concern per change when possible.
3. **Never commit secrets** — use `.env.local` only; see [SECURITY.md](./SECURITY.md).
4. Do not commit `supabase/.temp/`, `test-results/`, or local profile overrides (see `.gitignore`).
5. Run `bun run lint:check` and `bun run test`; add or update tests when behavior changes.
6. Describe what changed and how you verified it.

## Security

Report vulnerabilities privately — do not open public issues with exploit details. See **[SECURITY.md](./SECURITY.md)**.

## License

By contributing, you agree your contributions are licensed under the same terms as the code you modify:

- **Application** (root repo): [MIT](./LICENSE)
- **`llm/morph-physics`**: [Apache-2.0](./llm/morph-physics/LICENSE)
