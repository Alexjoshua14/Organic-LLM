---
name: preview-branch
description: >-
  Rebuilds the local preview branch so one checkout runs in-flight independent
  pull requests together. Rebases that checkout onto origin/develop (or main
  when asked), adds new pull request branches, and drops work the user
  declined. Use when the user asks to update, refresh, rebuild, or sync the
  preview branch, pull open PRs into preview, or take declined work out of preview.
---

# Preview branch

`preview` is a disposable local integration checkout. It is a fan-in of
independent branches on top of a trunk, so the app can run all of that work
at once. Work itself stays on the source branches and their pull requests.

A chain where each pull request targets the branch below it is a stack, not a
preview merge. Use the stacked-pull-requests skill for that.

## Files

- Script: `scripts/preview-branch.sh`
- Branch list: `<git-common-dir>/preview/branches` (`git rev-parse --git-common-dir`)
- Last build record: `<git-common-dir>/preview/last-build`

The list is one branch per line, merged in order. A `base <ref>` line replaces
the default trunk `origin/develop`. `#` starts a comment and must be the first
non-space character on that line. `name # note` is still merged, because the
script strips from `#` and keeps the name.

`preview` history is rebuilt from the list every time. Do not `git rebase`
`preview`. Do not `git revert` onto `preview`. The next rebuild erases both.
Do not push `preview` unless the user asks.

## Update

1. `git fetch origin`, then `scripts/preview-branch.sh --list`.
2. `gh pr list --state open --limit 100 --json number,title,headRefName,baseRefName,isDraft,url`.
3. Read the branch list and `git log --merges --oneline -20 preview`. Note
   merges on `preview` whose branches are not in the list. A rebuild drops them.
4. Plan the new list, then edit it, then rebuild. Show the plan in the reply
   before running the rebuild when it adds or drops a branch the user did not name.

### Trunk

Leave `base origin/develop` in place. Set `base origin/main` only when the user
asks to put preview on main.

### Add

Add the head branch of an open, non-draft pull request whose base is the trunk
(`develop`, or `main` when that is the base line) and whose name is not already
listed or recorded as declined.

When several pull requests form a chain, add only the top branch. Lower
branches are already inside it. The script prints `already contained` if a
listed branch is an ancestor of an earlier one.

Skip, and say so:

- Drafts, unless the user names them.
- Pull requests whose base is `preview`. They are deltas on the integration
  branch. Merging them changes what those pull requests contain.
- Pull requests already recorded as declined.

### Drop declined work

The user declining a pull request or a branch means it leaves the running tree.

- Comment the branch out as a full-line comment: `# declined: <branch> — <reason>`.
  Keep that line so a later update does not add it back.
- Rebuild. That removes its commits. No revert commit.

The user declining specific commits, while keeping the rest of that branch:
revert or drop those commits on the source branch, push or leave them local as
the branch already is, then rebuild preview from the updated tip. The source
branch stays the place the pull request is reviewed.

Merged or closed pull requests come off the list. They do not need a
`declined:` line.

### Extra merges

If local `preview` contains branches that are not in the list (a hand merge
such as `unified-personas`), put them in the plan. Add them to the list to
keep them, or name them as about to disappear. Do not rebuild over that
silently.

## Rebuild

The checkout that has `preview` checked out must have no uncommitted changes
to tracked files. Other worktrees can be dirty.

```bash
scripts/preview-branch.sh --verify
```

`--verify` typechecks before switching. Add `--build` only when the user wants
a production build. `--list` changes nothing.

Exit codes from the script:

- Conflict (exit 2): the temporary worktree is kept. Resolve there, `git add`
  the files, `git commit --no-edit`, then rerun. Rerere replays that
  resolution next time. If the conflict is the declined branch, remove it from
  the list instead of resolving, and rerun.
- Typecheck or build failure (exit 3): preview is not switched. Fix the source
  branch or drop it, then rerun.

## Report

After a rebuild, say:

- The new `preview` sha and the checkout path.
- Branches added, dropped, unchanged, and already contained.
- Anything left off on purpose (drafts, `preview`-based pull requests, declined).
- Whether local `preview` is ahead of `origin/preview`. Do not push unless asked.
