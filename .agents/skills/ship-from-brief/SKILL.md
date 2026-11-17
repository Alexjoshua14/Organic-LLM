---
name: ship-from-brief
description: >-
  Turns a pasted build brief into a tracked Ergon issue, an implementation,
  and a pull request. Use when the user pastes what to build and asks to track
  it, file an Ergon ticket, start implementation, and open a PR when ready, or
  when they invoke ship-from-brief.
---

# Ship from brief

The user pastes what to build. You file it, implement it, and open the PR.
Invoking this skill is an explicit request to create the Ergon issue, commit,
and open the PR.

## Track

1. Search Ergon for an existing issue that already covers the brief. Reuse it
   when the scope matches. Otherwise create one.
2. Team: **Coalescence Labs**. Project: **Organic LLM**, unless the brief names
   another project in that team.
3. State: **In Progress**. Assignee: **me**. Priority: medium unless the brief
   says otherwise.
4. Title is the outcome. Description states the gap, the scope, and done-when.
   Link a spec or ADR path when one exists. Do not paste private strategy.
5. Branch name: the issue's `gitBranchName`. Create it from current HEAD.
   Leave unrelated dirty files unstaged.

## Plan

Call a planning subagent before coding when the brief touches persistence,
prompt or context assembly, auth, or more than one subsystem.

- Tool: Task, `subagent_type` generalPurpose.
- Model: `claude-opus-5-5-max`. If that model is unavailable, use `grok-4.7-xhigh`.
- Prompt it with the brief, the code paths you already found, and your proposed
  design. Ask for APPROVE or CHANGE plus only the required changes.
- You implement. Do not hand the whole build to the subagent.

Skip the planning subagent for a localized bugfix you can already see the end of.

## Build

- Follow `AGENTS.md` and the doc that owns the area.
- Bump root `package.json` version with the app-semver skill when shipped
  behavior changes.
- Run `bun run test:unit` for the tests you touched, and `bun run lint:check`
  on the files you changed, before the review.

## Review

Before the PR, call a review subagent on the diff.

- Same model order as planning: `claude-opus-5-5-max`, then `grok-4.7-xhigh`.
- Give it the diff and the issue's done-when. Ask for blocking issues only.
- Fix blockers. Do not open the PR with a known blocker.

If both models are unavailable, say so in the PR body and continue.

## Pull request

1. Commit only the files for this issue. One commit unless the history is
   clearer split. Message focuses on why.
2. Push with `-u` and open the PR with `gh pr create`.
3. Body: summary, test plan, and the Ergon issue URL (`COA-…`).
4. Update the Ergon issue to **In Review** and add the PR link.

Do not merge unless the user asks.
