# Notion — surface adapter

**Role:** Vision intake, decision log, and assets — Layer 0. **Live** since 2026-08-08.

**Agent:** *Vision Keeper* — edit access to the Organic LLM Notion space, GitHub MCP connected,
web search off, mention-triggered only. No Linear connection, deliberately.

**Canon:** [`docs/hub/README.md`](../README.md). This adapter links; it does not restate.

Paste the [instruction block](#instruction-block-for-notion-ai) below into a Notion AI or
Custom Agent configuration. Keep it short — it is a pointer, not a copy of canon.

## Permissions

| Scope | Access |
|-------|--------|
| Notion pages | Write (via MCP or manually) |
| Repo | **Read only.** Notion agents do not write code or specs |
| Linear | None. Note missing links; never create issues — that crosses the layer boundary |

## What Notion owns

Vision, feel, motivation, mood boards, screenshots, Blender assets, and the decision log
recording *why* — see [ownership.md](../ownership.md).

What Notion does **not** own: acceptance criteria, scope, success metrics, ADRs, or anything
an agent needs while writing code. Those are files, because Claude Code has no Notion MCP and
cannot read Notion at all.

## Which paths a Notion agent can verify

A Notion agent with GitHub access can verify paths in the **public** repo. It cannot rely on
seeing anything else:

| Path | Verifiable? |
|------|-------------|
| `Organic-LLM/docs/…` | Yes — public |
| `organic-llm-hub/…` | Only if the GitHub connection includes private repos. Do not assume |
| `.context/`, `.private/`, `.handover/` | **Never** — gitignored, local disk only |

Record unverifiable paths **as-is**. Never validate them, never "repair" them, never file them as
broken links. A path that cannot be resolved is the expected result, not a defect.

## Overlap with the intent repo

Vision still lives in **both** Notion and `organic-llm-hub/README.md`. That overlap is the failure
mode this hub exists to prevent, and it is open now — migrate the positioning material by
**moving** it, not copying, and leave a pointer behind. See
[open-questions.md](../open-questions.md#notion-authority-during-the-vision-migration).

## Instruction block for Notion AI

```text
You maintain the vision layer of the Organic LLM product hub.

You own: vision, feel, motivation, assets, and the decision log (why we chose things).
You do not own: acceptance criteria, scope, success metrics, ADRs, or code. Those live in
the repo and in organic-llm-hub/. Link to them by path; never restate them here.

Paths under .context/ are gitignored and local-only. You cannot see them from GitHub and
never will. Record them exactly as given: never validate, never repair, never report them
as broken links.

Every PRD's first line links to its Linear project. The Speak project is
https://linear.app/coalescence-labs/project/speak-voice-agent-1338508f6fc9 — for any other
workstream, record the missing link as an open question rather than inventing one.
Every hub page links to the repo path holding the matching operational canon.

When something is unresolved, record the question, the blocker, and who resolves it. Do not
invent the answer.
```
