---
name: app-semver
description: >-
  Bumps root package.json semver (XX.YY.ZZ) so the sticky sidebar version stays
  current. Auto-updates minor (YY) and patch (ZZ); never bumps major (XX)
  without explicit user approval; advises when a major bump may be warranted.
  Use when finishing features, fixing bugs, preparing deploys or commits that
  change shipped app behavior, or when the user mentions version, semver,
  release, or app version.
---

# App semver (XX.YY.ZZ)

## Source of truth

Root [`package.json`](package.json) `"version"`. The sidebar reads it at build via `NEXT_PUBLIC_APP_VERSION` ([`next.config.js`](next.config.js) → [`lib/app-version.ts`](lib/app-version.ts) → [`components/sidebar/sidebar.tsx`](components/sidebar/sidebar.tsx)).

Do **not** bump `@organic-llm/morph-physics` unless that package’s own release is in scope.

## When to apply

One bump per **shippable unit of work** — when the change is ready to commit/deploy, or when the user asks to ship/commit. Not every mid-session edit.

## Bump policy

| Segment | Who | When |
|---------|-----|------|
| **ZZ patch** | Agent auto | Bug fixes, polish, refactors with no new user-facing capability |
| **YY minor** | Agent auto | New user-facing features, notable capability additions, backward-compatible expansions |
| **XX major** | User only | Breaking changes, large product resets, intentional milestones — **never** bump without explicit instruction |

Rules:

- Reset ZZ to `0` when bumping YY; reset YY and ZZ to `0` when bumping XX (standard semver).
- Edit only the root `package.json` `"version"` field.
- Do not create git tags or GitHub releases unless asked.
- After bumping, briefly state old → new and why (patch vs minor).
- Remind that the sidebar label updates on the **next build**.

## Major-version advisory (required)

When finishing work that looks like a major candidate, **tell the user** — do not bump. Flag when any of these apply:

- Breaking change to persisted data, public APIs, routes, or auth that existing users must migrate for
- Removing or replacing a core product surface in a way that invalidates prior mental models
- Intentional product milestone / rebrand / platform reset framed as a new generation
- Cumulative scope that has clearly outgrown the current major narrative (judgment — ask, don’t assume)

Message shape: short recommendation + one-line why + ask whether to bump major.

## Workflow

1. Read current `"version"` from root `package.json`.
2. Classify the change set → patch / minor / (advise major).
3. If patch or minor: edit `"version"` in place.
4. If major-worthy: inform the user; wait for explicit “bump major” (or similar).
5. Note that `NEXT_PUBLIC_APP_VERSION` picks up the new value on next build.
