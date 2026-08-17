# Maintenance protocol

How agents record what they learn. The hub is primarily agent-maintained — the user feeds it
through Organic LLM, Cursor, Claude Code, and Notion, and agents route each piece to its
canonical home.

> **If it's not written to canon, it didn't happen.**
>
> A decision that lives only in a chat transcript is lost. The session ends, the context
> compacts, the next agent starts cold and re-derives it differently.

## Step 0 — triage sensitivity (always first)

This repository is **public**. Before writing anything, ask: **would I mind a competitor
reading this?**

- **Yes** → the `organic-llm-hub` private repo, or Notion for vision and feel.
- **No** → `docs/`.
- **Unsure** → `organic-llm-hub/`, and link a neutral pointer from `docs/` if agents need to know
  it exists.

See [ownership.md](./ownership.md#the-sensitivity-test) for the full test.

## Routing by what changed

### Vision or feel changed

→ Notion vision page (live). `organic-llm-hub/` still holds positioning until it migrates.
→ If it changes build scope, also add to the relevant `open-questions.md`.

### Product intent changed — scope, acceptance criteria, UX

→ Update `organic-llm-hub/<feature>/product-spec.md`.
→ Bump `spec_revision` in its frontmatter when the change is material.
→ Open or update a Linear issue (Phase 3+).
→ Log the "why" in the Notion decision log if it is non-obvious.

### Technical decision made

→ Write an ADR at `docs/<feature>/decisions/YYYYMMDD-short-title.md`.
→ Public by default — ADRs are about code structure. If the *reasoning* is strategic, put the
   decision in the ADR and the strategic why in `organic-llm-hub/`, then link.
→ Link from the Linear issue when one exists.

### Behavioral rule locked

→ Update the feature's reference doc (e.g. [Speak tool behavior](../speak/tool-behavior.md)).
→ Mark it **Locked** with the date, so later agents don't relitigate it.

### New work identified

→ Create a Linear issue with `notion:` and `spec:` links (Phase 3+).
→ **Do not duplicate spec content into the issue body.** Link to it.
→ Until Linear exists, add it to the feature's roadmap section in `organic-llm-hub/`.

### Bug found

→ Linear issue, labelled for the feature (Phase 3+).
→ Link the spec section if the bug is behavioral rather than mechanical.

### Something is unresolved

→ Add it to an `open-questions.md` — private if it exposes product direction, public if it is
   operational.
→ **Record the question. Do not invent the answer.** Open questions close deliberately, with
   the user.

## Working rules

1. **Ask when ambiguous.** Do not assume. This product's direction is still forming, and a
   confident wrong guess written to canon is worse than an open question.
2. **Do not steamroll.** Hub docs are living artifacts refined over many sessions across many
   surfaces. Propose, don't overwrite.
3. **Link, never restate.** If you are copying a paragraph between hub docs, link instead.
4. **Adapters stay thin.** Surface adapters under [`surfaces/`](./surfaces/) are under 80 lines
   and contain pointers only.
5. **Legacy docs stay flagged.** `docs/speak-page-architecture.md` and
   `docs/speak-page-workflow.md` describe the pre-Realtime pipeline. Do not treat them as
   current or quietly update them — they are superseded, not stale.
6. **Commit only when asked.** Write files freely; leave `git commit` to the user.
7. **Never commit `.handover/`, `.context/`, `.private/`.** All three are gitignored and hold
   material that must not reach a public repo.

## When canon and code disagree

Code wins as a description of *what is*. Canon wins as a description of *what should be*.

When they diverge, that divergence is itself a fact worth recording: either the code drifted
from intent (file it), or intent moved and canon wasn't updated (update it). Do not silently
edit canon to match code — that erases the gap the hub exists to surface.
