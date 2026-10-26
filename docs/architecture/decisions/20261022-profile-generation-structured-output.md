# Profile generation: strict structured output, clamped in code

Settings → Profile generates a memory-grounded `ProfileTree` through a planner, per-section
writers and two reviewers (`lib/profile-generation.ts`, `POST /api/profile/summary`).

## What was wrong

Every generation failed, and the unit and integration tests could not see it because they fake
the model call.

- **Schemas rejected by the provider.** The planner and reviewer schemas used `.optional()` and
  `.default([])`. OpenAI strict structured output requires every property to be required, so the
  first call returned HTTP 400 and no section was ever written.
- **Sections were free text.** They were parsed from raw JSON with tools attached and a one-step
  limit. The prompt never defined the shape, so models invented one (objects where `items` are
  strings), renamed section ids (the review matches sections to plans by id), called the tool and
  returned no text, or hit the 450-token cap mid-object.
- **Output caps ignored reasoning.** Reasoning models spend output tokens thinking, so 400–800
  token caps returned truncated JSON.
- **One failure sank the run.** Any section error discarded every section and returned a 500.
- **The save step assumed a migration.** Without `profile_tree_revisions`, the run did all its
  work and then failed on save.

## Decisions

- **Everything the model returns is structured output with a strict-compatible schema:** all keys
  required, `null` or an empty array for "none". `tests/unit/profile-generation.test.ts` fails if
  a schema ever has an optional property.
- **Limits are requested in schema descriptions and enforced in code.** Models do not reliably honor
  length and count limits, and rejecting a whole run for a subsection too many is worse than
  clamping it (`clampText`, `normalizePlan`, `toProfileSection`). A section's id is always the plan's.
- **No tools in section writing.** Each section's memory evidence is fetched before the call.
- **Sections are written concurrently.** Each one sees the other sections' purposes so it does
  not repeat their facts. A section that fails is dropped with a warning; the run fails only if
  none can be written.
- **Output caps leave room for reasoning:** planner 2000, section 1200, section review 3000, tree
  review 1500. A run costs about $0.013 against a $0.35 ceiling and takes 40–60 seconds, so the
  route sets `maxDuration = 120`.
- **A missing revision-history table does not lose the run.** The live profile is saved and no
  revision id is returned.
- **A draft is a preview, not a save.** The reviewer's draft status still keeps a result out of
  the live profile; the page now says so instead of presenting it as saved.

## Verification

Four real runs against the production models on synthetic memories (no user data) succeeded in
40–60 seconds. This is not a regression test: the suite fakes the model, so re-run a live
generation after changing a schema, a model or a token cap.
