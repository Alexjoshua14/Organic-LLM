# Arcadia GitHub read

**Status:** Accepted (spike)
**Date:** 2026-10-02
**Affects:** `lib/github/`, `lib/llm/github/`, `lib/llm/github-tools.ts`, `lib/llm/compile-chat-tools.ts`

## Context

Arcadia chat can already call tools from the user-selected model (for example GPT-6 Astra). Reading a repository, its pull requests, and its recent commits through that model directly would place large untrusted source in the main context.

GitHub publishes a remote MCP server at `https://api.githubcopilot.com/mcp/`. Its tools return repository payloads to the caller. When this spike was created, the repo used AI SDK 5, so it called Jev through the gateway HTTP API (`POST /v1/evaluate`) instead of the SDK 7 `experimental_evaluate` API. The spike now builds on `develop` with AI SDK 7 and retains that HTTP evaluation path.

## Decision

Arcadia registers four custom read-only tools — `github_repo_overview`, `github_recent_commits`, `github_pull_requests`, and `github_read_file` — rather than the MCP tool list.

- The tools talk to the GitHub REST API. They do not push, comment, or merge.
- A repository is readable only when `GITHUB_READ_ALLOWLIST` names `owner/repo`. `*` also requires `GITHUB_READ_ALLOW_ANY=1`. The token should be a fine-grained PAT scoped to those repositories. One deployment token is shared by every Arcadia user; per-user OAuth is outside this spike.
- Files at or under 1,800 characters, when fidelity is `auto`, are returned as capped source with no extra model call.
- Larger reads go through an intelligent function. [Jev](https://vercel.com/ai-gateway/models/jev) (`typesafe-ai/jev`, zero data retention) chooses fidelity (`summary`, `excerpts`, or `raw`) and a distiller. Choices below 0.55 confidence are ignored.
- Distillation uses a cheaper zero-data-retention gateway model: Luna (`openai/gpt-6-luna`), Terra (the `openai.terra` alias, currently GPT-6 Sol), Haiku (`anthropic/claude-haiku-4.5`), or Kimi (`moonshotai/kimi-k2.7-code`). The Kimi slot is K2.7 Code, the code-oriented family pin, not the K3 chat picker.
- `raw` still caps what the main model sees (6,000 characters). If distillation fails, the tool returns that capped slice and marks `router: "distill_failed"`.
- If Jev or the gateway key is unavailable, a heuristic picks fidelity and distiller. The main chat model is unchanged.
- `listGithubMcpTools` can list the remote MCP tool names for comparison. Those names are not registered on the Arcadia toolbelt, because they would skip the distillation cap. A live probe on 2026-10-02 against `https://api.githubcopilot.com/mcp/` returned 46 tools. The set includes the reads this spike needs (`get_file_contents`, `list_commits`, `list_pull_requests`, `pull_request_read`) and writes (`create_or_update_file`, `delete_file`, `merge_pull_request`, `push_files`). Registering that list would skip distillation and expose writes. The same session confirmed the REST client against public `octocat/Hello-World` (repository metadata, recent commits, and `README`).

## Consequences

- Topic explore does not get these tools. Only `experience === "arcadia"` does.
- A missing allowlist returns `not_configured`. The model is instructed not to invent repository contents.
- Repository text is sanitized and labeled untrusted, same stance as web search snippets.
- Jev evaluation still uses the gateway HTTP API; moving it onto `experimental_evaluate` is a separate change.
