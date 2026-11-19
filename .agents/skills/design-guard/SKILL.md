---
name: design-guard
description: >-
  Audits a UI diff against Organic's design rules with a script instead of judgement: raw
  px/rem/em/hex values, Tailwind arbitrary values, inline-style numbers, Lumen and focus
  violations (hover fills, focus rings, removed outlines), timing literals, components that were
  swapped out, and files the request never named. Use before reporting any UI work as done,
  after the owner gives feedback on spacing, color, hover or focus, when they say "use my
  tokens", or when checking that a change stayed in scope. Applies to components/, styles/,
  app/**/*.tsx, content/blog and sandbox prototypes.
---

# Design guard

The token rule ([design-backbone](../../rules/design-backbone.md) 8 and 9) was written into the
repo after the same correction came up repeatedly. Prose did not hold, so a script checks it.
`scripts/design-guard.ts` reads **added lines only** from a diff, so legacy code is never flagged
until someone touches it.

## Run it

Run it after the last edit and before you hand work back. Do not commit for it.

```bash
bun run design:guard                                  # working tree vs HEAD, plus untracked files
bun run design:guard --paths components/chat/x.tsx,styles/y.css   # only the files you touched
bun run design:guard --scope "components/chat/core-input/**"      # + flag files the request never named
bun run design:guard --base origin/develop            # a whole branch
bun run design:guard --range abc123~1..abc123         # one past commit or a PR range
```

In a **shared checkout** other agents' uncommitted files are in the diff too. Pass `--paths` with
the files you touched, or you will audit (and want to "fix") someone else's work. Exit code 1
means at least one error.

## Read the result

| Finding | What to do |
|---|---|
| `error` | Fix it with a token. The hint names the match (`12px is stack-md / inline-md / inset-md`; pick the role: stack = vertical rhythm, inline = gaps, inset = padding). |
| `[ask]` | **Stop and ask.** No token fits the value. Put the question to the owner with `AskUserQuestion`: (a) change an existing token, naming where it is used; (b) add a token, with a proposed name and value; (c) a documented one-off. Name the guideline it strains. Never pick a nearby literal or borrow a token from another role. |
| `hover-fill-color`, `focus-ring`, `interaction-removed` | These are the Lumen and focus rules ([Lumen](../../../docs/design/lumen.md), [focus feedback](../../../docs/design/focus-feedback.md)). Hover never changes a Lumen surface's fill; keyboard focus is Lumen or a surface/text change, never a ring. Restore what was removed unless the owner asked for it gone. |
| `component-swap` | An imported project component or hook is no longer used in that file. Put it back unless replacing it was the request. |
| `scope-creep` | A file changed that `--scope` did not name. Revert it, or tell the owner why it had to change. |
| `warn` | Judge it. A timing literal belongs in a named constant beside the effect. A forced-colors fallback or hairline is already exempt. Say in the handoff what you left and why. |

Fix, then rerun until the errors are gone. Report the final line (`design-guard: clean`, or the
warnings you kept with reasons).

## Rules for this skill

- **Never add `design-guard: allow <reason>`** yourself. That marker is the documented one-off
  exception in rule 9, and it needs the owner's decision first. A marker with no reason is an
  error.
- **A false positive is a bug in the script, not a reason to suppress.** Tell the owner, then fix
  the rule in `scripts/design-guard.ts` and add a case to `tests/unit/design-guard.test.ts`.
- **When a design rule changes**, change the doc, `design-backbone.md` and the script together, in
  the same change. The script's token scale is read from `styles/globals.css`, so a new token is
  picked up on its own.
- In CSS, a Tailwind-scale value is `calc(var(--spacing) * N)`; in class names it is the scale
  already used in the file (`min-h-11`, `size-9`).

## What it cannot see

It sees text, not pixels. Not covered: numbers inside a multi-line `style` object (only a
same-line `style` is checked), class names assembled at runtime, whether the *right* token was
chosen, contrast, and how the result looks. Check those on a running server at phone, desktop and
wide, in both themes. The owner starts servers, so ask before starting one.
