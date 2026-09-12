@AGENTS.md

## Claude Code

Claude Code reads this file, not `AGENTS.md` — the import above is what loads it. Keep
Claude-specific notes here; everything shared belongs in `AGENTS.md`.

- Notion MCP is unavailable here, so product intent lives in `organic-llm-hub/` as files rather
  than in Notion. See [`docs/hub/surfaces/claude-code.md`](docs/hub/surfaces/claude-code.md).
- `.claude/` and `.cursor/` are gitignored, so skills and rules do not travel between machines.
  Anything load-bearing goes in `AGENTS.md`.
