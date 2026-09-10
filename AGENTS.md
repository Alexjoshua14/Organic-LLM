# AGENTS.md

Organic LLM — a full-stack Next.js AI app and design lab: chat, persistent memory,
rabbit-hole research, generative UI, a Speak voice agent, and shippable packages under `llm/`.

Runtime: Node ≥ 20, **Bun** as package manager and test runner (`bun.lock`).

## Read before you work

Route to the doc that owns the topic. Do not re-derive what is already written down.

| Working on | Read first |
|------------|------------|
| Product or feature specs, decisions, roadmap | [`docs/hub/README.md`](docs/hub/README.md) |
| Speak / voice | [`docs/speak/README.md`](docs/speak/README.md) |
| Remy / meal prep | [`docs/remy/README.md`](docs/remy/README.md) |
| UI, motion, spacing, loading states | [`docs/design/README.md`](docs/design/README.md) |
| Architecture orientation | [`docs/INDEX.md`](docs/INDEX.md) |
| Chat tools and the assistant toolbelt | [`docs/chat-tools.md`](docs/chat-tools.md) |
| Threads, persistence, encryption | [`docs/thread-session-architecture.md`](docs/thread-session-architecture.md) |
| Setup, env vars, PRs | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Commands

```bash
bun install                 # dependencies
bun dev                     # dev server (Turbopack) on :3000
bun run lint:check          # ESLint, CI-style, no auto-fix
bun run lint                # ESLint with --fix
bun run test                # unit + integration
bun run test:unit           # unit only — fastest useful signal
bun run test:integration
bun run test:e2e            # Playwright; needs E2E_CLERK_* for signed-in flows
bun run build               # Next.js production build (also builds morph-physics)
```

Run `bun run lint:check` and `bun run test:unit` before handing work back. CI runs tests on
PRs to `main`; changes under `llm/morph-physics/` trigger a separate workflow.

## Structure

| Path | Holds |
|------|-------|
| `app/` | Next.js App Router routes and API handlers |
| `components/` | Shared UI, including `components/chat/gen-ui/` blocks |
| `lib/` | Domain logic — `lib/llm/`, `lib/memory/`, `lib/speak/`, `lib/schemas/` |
| `hooks/` | Client hooks (e.g. `hooks/use-realtime-voice.ts`) |
| `tests/` | `unit/`, `integration/`, `e2e/`, plus shared `helpers/` and `fixtures/` |
| `content/dev-docs/` | In-app developer docs served at `/dev/docs` |
| `llm/` | Shippable packages (`@organic-llm/morph-physics`) |

## Style

- Match the surrounding file — its naming, comment density, and idioms — over any general
  convention. Read a neighbour before adding a pattern.
- Timing and animation constants live next to the effect, not inline in components. Docs record
  the *why* and the approved range.
- Tests use Bun's runner with the preloads already wired in `package.json` scripts. Put shared
  setup in `tests/helpers/`.

## Boundaries

**Always**

- Read [`docs/hub/README.md`](docs/hub/README.md) before product or feature-spec work, and
  follow its [maintenance protocol](docs/hub/maintenance-protocol.md) when you decide something.
- Follow [`docs/design/README.md`](docs/design/README.md) for anything the user sees or feels.
- Sensitivity-check every doc you write. **This repository is public.**

**Ask first**

- Major architectural changes, or new dependencies.
- Creating Linear or Notion resources. Notion is agent-owned; Linear holds open questions only,
  and implementation issues are gated — see `docs/hub/phases.md`.
- Bumping the major version — see `.cursor/skills/app-semver/SKILL.md`.
- `git commit`. Write files freely; commit only when the user asks.

**Never**

- Commit secrets, or anything from `.handover/`, `.context/`, `.private/`, `.local-profile.md`.
  All are gitignored and hold material that must not reach a public repo.
- Put strategy, roadmap, or competitive analysis in `docs/`. That belongs in `organic-llm-hub/`.
- Duplicate hub canon across docs, skills, or adapters. Link instead.
- Treat `docs/speak-page-architecture.md` or `docs/speak-page-workflow.md` as current — both
  describe the superseded pre-Realtime TTS pipeline.
- Resolve an open question by assumption. Record it; close it with the user.
