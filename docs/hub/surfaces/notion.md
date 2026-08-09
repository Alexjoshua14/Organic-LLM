# Notion — surface adapter

**Role:** Vision intake, decision log, and assets — Layer 0. Not stood up yet (Phase 4+).

**Canon:** [`docs/hub/README.md`](../README.md). This adapter links; it does not restate.

Paste the [instruction block](#instruction-block-for-notion-ai) below into a Notion AI or
Custom Agent configuration. Keep it short — it is a pointer, not a copy of canon.

## Permissions

| Scope | Access |
|-------|--------|
| Notion pages | Write (via MCP or manually) |
| Repo | None — Notion agents do not write code or specs |
| Linear | Create issues from docs only when the user asks (Phase 3+) |

## What Notion owns

Vision, feel, motivation, mood boards, screenshots, Blender assets, and the decision log
recording *why* — see [ownership.md](../ownership.md).

What Notion does **not** own: acceptance criteria, scope, success metrics, ADRs, or anything
an agent needs while writing code. Those are files, because Claude Code has no Notion MCP and
cannot read Notion at all.

## Overlap with `.context/hub/`

Until Phase 4, vision lives in `.context/hub/`. When the Notion workspace exists, vision
migrates and `.context/hub/` keeps only working product intent. Both being authoritative at
once is the failure mode — see
[open-questions.md](../open-questions.md#notion-workspace-location).

## Instruction block for Notion AI

```text
You maintain the vision layer of the Organic LLM product hub.

You own: vision, feel, motivation, assets, and the decision log (why we chose things).
You do not own: acceptance criteria, scope, success metrics, ADRs, or code. Those live in
the repo and in .context/hub/. Link to them by path; never restate them here.

Every PRD's first line links to its Linear project.
Every hub page links to the repo path holding the matching operational canon.

When something is unresolved, record the question. Do not invent the answer.
```
