# Cursor instruction adapters

Shared instructions live in [`.agents/`](../.agents/), not here. This directory
keeps Cursor's discovery and rule-matching configuration separate from that shared content.

## Skills: symlinks, not copies

Each entry in `skills/` is a relative symlink to `.agents/skills/<name>/`.
Claude's skill entries point to the same source. Editing through either link edits
the shared file; there are no separate copies to synchronize.

## Rules: thin Cursor adapters

Cursor's `.mdc` rules use `description`, `globs`, and `alwaysApply` metadata.
The shared `.agents/rules/*.md` files use `paths` for Claude's scoped rules.
Keeping these formats separate preserves each tool's matching configuration.

Files in `rules/` therefore contain only Cursor metadata and a link instructing
the agent to read the shared rule. The actual instructions live in `.agents/rules/`.
Claude uses symlinks to those files; [AGENTS.md](../AGENTS.md) routes agents,
including Codex, to the shared rules explicitly.

## Where to edit

- **Skill instructions or supporting files:** `.agents/skills/<name>/`.
- **Rule instructions:** `.agents/rules/<name>.md`.
- **Cursor rule matching:** the corresponding `rules/<name>.mdc`; keep its
  `globs` aligned with the shared rule's `paths`.

The README, skill links, and explicitly allowed rule adapters are Git-visible.
Local settings, worktree configuration, and plans remain ignored by
[`.gitignore`](../.gitignore).
