# Cursor — surface adapter

**Role:** Implementation agent with full repo write access.

**Canon:** [`docs/hub/README.md`](../README.md). This adapter links; it does not restate.

## Permissions

| Scope | Access |
|-------|--------|
| `docs/hub/`, `docs/<feature>/`, code, tests | Write |
| `.context/hub/` (private intent) | Write — never move content into `docs/` |
| Linear, Notion resources | Ask first (Phase 3+) |
| `git commit` | Only when the user explicitly asks |

## Skill

`.cursor/skills/organic-llm-hub/SKILL.md` — user-triggered hub workflows: filing a decision,
writing an ADR, updating a feature spec, syncing canon per protocol.

The skill is a **workflow**, not the routing layer. Broad routing lives in
[`AGENTS.md`](../../../AGENTS.md) because always-loaded files outperform on-demand skills —
Vercel's agent evals measured a default skill at 53%, identical to no docs at all, against 100%
for an AGENTS.md docs index. Anything that must not be missed belongs in `AGENTS.md`.

`.cursor/` is gitignored, so the skill is local to this machine. The same directory is
symlinked into `.claude/skills/` so Claude Code reads the one file.

## Rules

`.cursor/rules/design-backbone.mdc` applies to UI and motion work. Keep rules lean and
glob-scoped; put detail in the doc they point at.

## MCP

Linear and Notion are available in Cursor. **Do not create external resources unless the user
explicitly asks** — Linear is Phase 3, Notion is Phase 4.

## Before you write

1. Sensitivity check — this repo is public. See
   [maintenance-protocol.md](../maintenance-protocol.md#step-0--triage-sensitivity-always-first).
2. Route per [ownership.md](../ownership.md).
3. Record per [maintenance-protocol.md](../maintenance-protocol.md).
