---
name: worktree-integrate
description: Implement coding changes in an isolated Git worktree, validate and commit finished work, then integrate it into the user's primary checkout for review through one running dev server. Use when the user requests this shared-checkout workflow or invokes this mode; do not apply to ordinary coding requests by default.
---

# Worktree integration mode

The user may have another coding agent working concurrently. Keep implementation isolated while developing, then centralize finished work in the primary checkout so the user can review all changes through their existing dev server and eventual shared PR.

## Establish the workspace

- Read the repository's `AGENTS.md` and relevant guidance. Inspect the primary checkout's branch, HEAD, working-tree status, and existing worktrees before making changes.
- Treat “main directory” as the user's primary checkout. Integrate into its existing working branch unless the user explicitly names another target; do not switch it to the branch named `main` by assumption.
- Create a dedicated branch and worktree from that checkout's current HEAD, or reuse this session's established worktree. Make implementation changes there.
- Work only on the requested aspects. If the user has only established the mode, prepare the worktree and ask for the first concrete change without inventing feature work.

## Complete each change

- Preserve concurrent edits and keep commits scoped to your own work. Follow repository checks and run verification appropriate to the change before integration.
- Commit finished, reviewable increments in the isolated worktree. This mode requests local commits and integration; do not ask again for those steps when already authorized by the user.
- Stage explicit files or hunks belonging to your change. Never include another agent's work, secrets, or private local files.
- Do not install packages in worktrees or run builds unless the user later explicitly requests them. Use existing dependencies in the primary checkout for focused checks after integration; never disturb its running dev server or build output.
- Keep small refinements lightweight and integrate them promptly. Avoid unnecessary full test runs, duplicate dependency trees, caches, or background processes.
- Prefer the user's existing dev server. If a temporary server is necessary, stop it within five minutes of starting it, and stop it immediately after its check finishes. Remove any temporary dependency tree or build cache you created.

## Integrate into the primary checkout

- Recheck the primary branch, HEAD, and working-tree status immediately before integration; another agent may have advanced them.
- Bring your completed commits into that checkout's current integration branch, normally by cherry-picking the specific commits. Transfer only your commits, not unrelated branch history.
- Preserve unrelated uncommitted changes. Never automatically stash, discard, reset, or commit the other agent's edits to make integration succeed.
- Resolve committed-history conflicts when the intended combination is clear. If integration overlaps uncommitted work or depends on an unclear competing change, keep your completed commits available and ask for coordination rather than overwriting it.
- Verify the integrated result as appropriate. Leave the existing dev server running so it can pick up the changes from the primary directory.
- Report what changed, validation results, commit IDs, and whether integration completed. Identify any remaining blocker precisely.

Do not push, publish, deploy, or open a new PR unless separately requested. The user may be collecting all agents' work into one branch and one PR for later review.
