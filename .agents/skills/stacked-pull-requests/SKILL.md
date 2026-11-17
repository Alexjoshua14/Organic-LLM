---
name: stacked-pull-requests
description: >-
  Creates and updates GitHub stacked pull requests for a dependent chain of
  branches. Rebases the stack onto develop or main, adds a new layer, and
  drops a layer the user declined without a revert commit. Use when the user
  mentions stacked PRs, gh stack, a pull request targeting another pull
  request's branch, or splitting one change into dependent layers.
---

# Stacked pull requests

A stack is one linear chain in this repository. The bottom pull request
targets the trunk. Each pull request above targets the branch under it. The
top branch contains every layer below it.

Independent pull requests that should run together in one checkout are not a
stack. Use the preview-branch skill for that fan-in. Stacks cannot fan in.

Public preview, and it can change. Docs:
[About stacked pull requests](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[CLI commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands).

## This repo

Trunk is `develop` unless the user says `main`. The repository default branch
is `main`, so pass `--base develop` on `gh stack init`. Do not use the local
`preview` branch as a trunk. `preview` is a disposable fan-in.

Install once if `gh stack` is missing:

```bash
gh extension install github/gh-stack
```

The working tree must be clean before `sync`, `rebase`, or `modify`.

## Create or adopt

Existing branches, bottom to top:

```bash
gh stack init --base develop bottom-branch next-branch top-branch
gh stack submit
```

`submit` pushes, opens pull requests, and links the stack. New pull requests
default to ready for review in the interactive editor. Use `--auto` only when
a non-interactive submit is required; those open as drafts unless `--open` is
set.

A new layer on top of the current top:

```bash
gh stack add branch-name
gh stack submit
```

A chain that already exists as pull requests (each base is the branch below)
and is not yet a GitHub stack: `gh stack link` with those pull requests, bottom
to top. Do not retarget them onto `preview`.

## Update onto the trunk

```bash
gh stack sync
```

That fetches, fast-forwards the trunk, rebases upward when the trunk moved,
and force-with-lease pushes. If the local and remote stack compositions
diverged, stop and tell the user. Do not pick "use remote" or "delete the
GitHub stack" without them.

When `sync` restores branches and points at conflicts, resolve with:

```bash
gh stack rebase
gh stack push
```

`rebase` runs from the trunk upward. `push` uses `--force-with-lease`.

## Declined layer

Do not `git revert` a layer. A revert stays in history and shows up in the
diffs above it.

On the stack, with a clean tree:

```bash
gh stack modify
```

Drop the declined branch with `x`, then Ctrl+S. Drop removes that branch's
commits from the chain and rebases everything above. The local branch and its
pull request stay open. Close the pull request only when the user wants it
closed.

Fold (`d` into the branch below, `u` into the branch above) only when the user
wants those commits kept inside a neighbor.

Conflicts: fix, stage, `gh stack modify --continue`. Abort with
`gh stack modify --abort`. Then `gh stack submit` so GitHub replaces the stack.

Declined commits inside a layer that stays: edit that layer's branch, then
`gh stack rebase --upstack` from that branch and `gh stack push`.

## Report

Say the trunk, the order of branches, which pull requests are linked, what
moved onto the new trunk, and any layer dropped. Do not merge unless the user
asks. Merging is bottom-up: merging a pull request also merges everything
below it.
