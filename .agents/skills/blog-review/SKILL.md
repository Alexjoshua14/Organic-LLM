---
name: blog-review
description: >-
  Reviews an Organic LLM blog post with a panel of four review subagents
  (writing, visual layout across screen sizes, a recruiter's read, and a
  non-technical reader's read), then addresses their feedback, ships it in the
  open PR, and keeps Ergon in sync. Use when the user asks to review, critique
  or polish a blog post or article under app/blog, or invokes blog-review.
---

# Blog review

Invoking this skill is an explicit request to run review subagents, edit the
post, commit, and open or update a PR. It must run to completion without the
owner approving tool calls, so prepare everything each reviewer needs up front
and keep their tools to ones that never prompt.

## 1. Prepare the context (parent agent)

Reviewers start cold. Hand each one files, not instructions to go find them.

1. **Post source.** The page under `app/blog/<slug>/page.tsx` and its content
   file under `content/blog/`.
2. **Rendered text.** Load `/blog/<slug>` on a server that is already running
   (ask before starting one) and save `document.querySelector('article').innerText`
   to the scratchpad as `post.txt`. Blog routes are public, so no sign-in.
3. **Screenshots.** With the preview tools, capture the post at three widths,
   in dark and light: phone (390), desktop (1280), wide (1920). Capture the
   full length by scrolling one viewport at a time; save each to the
   scratchpad with its width, theme and index in the name. Note the device
   pixel ratio so reviewers can read sizes correctly.
4. **Homepage first impression (for the recruiter).** Capture the first 200vh
   of `/` (two viewports) at desktop and phone, and save its visible text as
   `homepage.txt`. This is all the recruiter knows about Organic LLM.
5. **Images used by the post** (under `public/blog/<slug>/`): list their paths.

Write a short `context.md` in the scratchpad that lists every file above.

## 2. Run the panel

Launch four subagents in parallel (`Agent`, `run_in_background: false`), each
with the full paths from `context.md`. Tell every reviewer:

- Use only `Read`, `Grep` and `Glob`. Do not use Bash, do not edit files, do
  not start or stop servers. (These never prompt, so the run can finish
  unattended.) The visual reviewer reads the PNG screenshots with `Read`.
- Be specific: quote the exact sentence or name the exact section and width.
- Return the structure below and nothing else.

```
## Verdict
One paragraph.
## What works
- …
## Must fix
- [section or quote] problem → suggested change
## Should fix
- …
## Nice to have
- …
```

The four reviewers:

1. **Writing.** Tone, prose, structure, flow, consistency of voice, clarity of
   each section's point, sentence-level edits. The owner's voice stays; no
   bragging, no filler.
2. **Visual.** Layout and visual appeal at phone, desktop and wide, in dark and
   light: hierarchy, rhythm and spacing, image framing and scale, readability,
   overflow, how custom figures (tables, demos, captions) hold up. Judge
   against `docs/design/README.md` and the design tokens (`styles/globals.css`,
   `docs/design/spacing.md`); suggest token-based fixes, never literals.
3. **Recruiter.** Knows nothing about Organic LLM beyond the homepage capture.
   Reads the post and reports what they learned about the developer: methodology,
   design sense, engineering judgment, and what is genuinely impressive, from
   the vantage of hiring for Anthropic, OpenAI, Apple, Figma and design
   boutiques. Flags anything that undersells real work, reads as bragging, or
   assumes context a stranger lacks. Honest, not flattering.
4. **Non-technical reader.** A smart friend who is a lawyer, not technical.
   Reports where they got lost, which jargon earned its place and which
   didn't, and whether each section's point landed. Jargon is fine sparingly,
   only where it adds real value.

## 3. Address the feedback

1. Merge the four reports into one list; resolve conflicts in favour of
   clarity for the non-technical reader unless it costs the recruiter's
   picture of the work. Note anything you decline and why.
2. Edit the post. Follow `.agents/rules/design-backbone.md`: tokens, never
   literals. Keep the owner's voice; refine, don't rewrite it.
3. Verify in the browser at the three widths, both themes. Run
   `bun run lint:check` and the tests touching the post, if any.

## 4. Ship and track

1. Commit (the owner invoked the skill, so committing is approved). Push to the
   open PR for this work if one exists; otherwise open one against `develop`.
   Put before/after screenshots in the PR body. Never include a Claude session
   link or "Generated with" line.
2. Ergon: comment on the related issue with the panel's findings (short) and
   what changed, attach the PR, and keep its state accurate. If Ergon lacks a
   field or feature the work needed (for example image attachments), search
   for an existing issue and +1 it with a comment, or file one in the Organic
   LLM project.
3. Report: what each reviewer said in one line, what changed, what you
   declined, and what was not verified.
