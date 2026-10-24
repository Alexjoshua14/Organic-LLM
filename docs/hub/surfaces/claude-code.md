# Claude Code — surface adapter

**Role:** Implementation agent with full repo write access. Runs on more than one machine.

**Canon:** [`docs/hub/README.md`](../README.md). This adapter links; it does not restate.

## How Claude Code reaches canon

Claude Code reads **`CLAUDE.md`, not `AGENTS.md`** — this is documented behavior, not a gap to
work around informally. The root [`CLAUDE.md`](../../../CLAUDE.md) therefore imports
[`AGENTS.md`](../../../AGENTS.md) with `@AGENTS.md` and adds nothing that duplicates it.

`CLAUDE.md` and `AGENTS.md` are the only tracked agent-config files. `.claude/` and `.cursor/`
are both gitignored, so skills and rules do not travel between machines — anything load-bearing
must live in `AGENTS.md`.

## Permissions

| Scope | Access |
|-------|--------|
| `docs/hub/`, `docs/<feature>/`, code, tests | Write |
| `organic-llm-hub/` (private intent) | Write — never move content into `docs/` |
| Linear resources | Ask first (Phase 3+) |
| `git commit` | Only when the user explicitly asks |

## Skill

`.claude/skills/organic-llm-hub/` is a **symlink** to `.cursor/skills/organic-llm-hub/`, so both
tools read one file and cannot drift. Claude Code follows symlinked skill directories.

Scope is user-triggered hub workflows. Broad routing stays in `AGENTS.md` — see
[cursor.md](./cursor.md#skill) for why.

## MCP

Linear is available. **Notion MCP is not available in Claude Code** — if canon lives only in
Notion, Claude Code cannot read it. This is why product intent lives in `organic-llm-hub/` as
files rather than in Notion.

## Before you write

1. Sensitivity check — this repo is public. See
   [maintenance-protocol.md](../maintenance-protocol.md#step-0--triage-sensitivity-always-first).
2. Route per [ownership.md](../ownership.md).
3. Record per [maintenance-protocol.md](../maintenance-protocol.md).
