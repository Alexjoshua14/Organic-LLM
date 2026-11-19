---
name: blog-from-work
description: >-
  Writes an Organic LLM blog post from work that already happened: the Ergon tickets, the PR,
  the design docs, before and after captures and the owner's own words become a case-study page
  under app/blog, then the blog-review panel runs on it. Use when the owner asks for a blog
  page, write-up or case study about an upgrade, redesign or decision ("create a blog page about
  the v2 to v3 upgrade", "write this up", "include the issues I had and the options I weighed").
---

# Blog from work

The model is the CoreInput v3 post (`app/blog/core-input-v3/`, `content/blog/core-input-v3-content.tsx`).
It works because it is honest and specific: real problems with evidence, the options actually
weighed including the one that failed, a decision with its conditions, and what is still open.
This skill gathers that story from the work trail and builds the page. [blog-review](../blog-review/SKILL.md)
then judges it; do not skip that step.

The blog is **public**. Run the sensitivity check in
[maintenance-protocol](../../../docs/hub/maintenance-protocol.md) first: no private strategy,
roadmap or competitor analysis, no hostnames, keys or private URLs, no real user data. Private hub
material may inform the story; summarise it, never quote it.

## 1. Gather the trail (read only)

- **Ergon:** the issue and its comments (`get_issue_brief`), related and parent issues, linked
  documents and decisions. These hold the problems as they were first described.
- **Git:** the PR (`gh pr view`), the commits (`git log --grep <COA-n>`), the diff for what truly
  changed.
- **Docs:** the matching `docs/design/` page for approved values and reasons; the hub for private
  intent, summarised only.
- **The owner's words:** the thread you are in and earlier ones they point to. Their phrases
  carry the voice; reuse them. Never invent a quote, a number or a motive.
- **Captures:** legacy (before) and new (after) shots. If the legacy UI was not captured before it
  was replaced, say so and ask; do not fabricate one.

Note every claim you plan to make next to its source. A number in the copy ("about the last 23
words were visible") must be one you can point to in the work.

## 2. Outline: problem, options, decision, result

1. **Header.** `Category · Month Year`, a plain title, two short paragraphs: what Organic LLM is in
   one sentence for a stranger, and what this post is.
2. **Where it was struggling.** Short cards, one real problem each (icon, title, one line),
   followed by the evidence screenshot.
3. **The options I weighed.** The chosen one, then the others, each with its honest take and why
   it lost. Include something you dropped (v3's "A mobile panel I didn't build") and say why.
4. **The decision and its conditions.** What must still be proven before it ships everywhere.
5. **The new design.** Captures or a short clip, with captions that say what to look at.
6. **What changed for each problem.** Map every problem from section 2 to its outcome, or say it
   is unresolved.
7. **Details worth keeping** (timings, token choices, a rule that was settled) only where they
   teach something.
8. **What's next.** Real open items. Then a link back to `/blog`.

Voice: the owner's, first person, plain and specific. One point per section, jargon defined once,
numbers over adjectives, no bragging and no filler. If it flatters, cut it.

## 3. Build it

Follow the v3 post's files; read it before writing.

| Piece | Where |
|---|---|
| Route | `app/blog/<slug>/page.tsx`: `metadata` (title, one-line description), `PageContentFrame maxWidth="2xl"`, `PageNavBack href="/blog"`, `<article className="p-inset-md text-foreground sm:p-inset-lg">` |
| Content | `content/blog/<slug>-content.tsx`, with `BlogSection` from `components/blog/blog-section.tsx` and the `glass()` primitive |
| Styles | A CSS module only if needed (`content/blog/<slug>.module.css`) |
| Assets | `public/blog/<slug>/`, dark and light as a pair, named `legacy-*`, `<ver>-*` |
| Index | One entry in `POSTS` in `app/blog/page.tsx` (`category`: `surfaces`, `architecture` or `design`) |

- **Screenshots:** every before/after pair at the **same width** so comparison is fair (v3 renders
  phone captures at one width). Dark and light follow the reader's theme. `next/image` with the
  real pixel width and height (`file public/blog/<slug>/*.png`), meaningful `alt`, and a caption.
- **Clips:** short, muted, looping `mp4` per theme, plus a still of the end state for reduced
  motion (v3's `*-stacking-end-*.png`). Honor `prefers-reduced-motion`.
- **Motion:** `Reveal`, `Stagger` and `BLOG_REVEAL` live in `content/blog/core-input-v3-motion.tsx`.
  A second post that needs them should move them to `components/blog/` first and say so; do not
  import one post's file from another.
- **Tokens, never literals.** Spacing, type, color and timing from the token system, even though
  older posts predate it ([design-backbone](../../rules/design-backbone.md) 8 and 9). Interactive
  elements follow [Lumen](../../../docs/design/lumen.md) and
  [focus feedback](../../../docs/design/focus-feedback.md).
- Text-heavy posts can stay Markdown (`content/blog/*.md` through `BlogProse`); a visual story
  belongs in TSX.
- No new dependency without asking.

## 4. Check, then review

1. `bun run design:guard --paths <the files you added>`, `bun run lint:check`, and any test that
   touches the blog.
2. Look at it on a running server at 390, 1280 and 1920, dark and light. Ask before starting one.
3. **Run [blog-review](../blog-review/SKILL.md)** and address its panel. Its shipping step
   (commit, PR, Ergon) applies only if the owner's request asked for it; if they did not, stop
   after the edits and say so.

## 5. Ship and track (when asked)

Put the post in the open PR for the work if there is one (AGENTS.md: prefer an existing related
PR); otherwise a PR to `develop`. Bump the version with [app-semver](../app-semver/SKILL.md): a
new public page is shipped behaviour. Add before and after screenshots to the PR body. Comment on
the Ergon issue with what shipped and the PR link, and keep its state accurate.
