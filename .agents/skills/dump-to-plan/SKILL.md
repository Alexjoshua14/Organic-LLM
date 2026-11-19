---
name: dump-to-plan
description: >-
  Turns a rapid-fire brain dump into a reviewed plan filed in Ergon, then waits for "go". Use
  when the owner says they are dumping, listing or "telling you what changes I want", asks you to
  take note, update tickets and get ready to implement, wants tickets and a plan for tonight, or
  pastes a loose list of wanted changes and asks for a plan. Captures verbatim, triages against
  existing tickets and the repo's ask-first rules, estimates in agent time, files via Ergon
  intake, and presents one screen. It does not implement.
---

# Dump to plan

The owner thinks out loud in bursts and often is **not reading your replies** while they do. The
job is to keep every item, lose none of their words, file a plan they can approve in one glance,
and build nothing until they say go. Invoking this skill is an explicit request to create and
update Ergon issues and documents (routine tracking under [AGENTS.md](../../../AGENTS.md)). It
is not a request to commit, start a server or implement.

## 1. Capture (while they dump)

- Keep a ledger in the scratchpad (`dump.md`): one numbered entry per request, **their words
  verbatim**, plus the path of any screenshot or recording they attach. Do not summarise yet.
- Reply with one short line ("Noted: 7 so far"). No questions, no analysis, no ideas, unless you
  are truly blocked. Hold questions for step 3.
- Later instructions win over earlier ones. Record the supersession in the ledger, keep both
  lines.
- A standing instruction ("assume things I mention are tonight", "use Cursor for subagents",
  "commit at checkpoints") is not a ticket. Put it in a `Standing` section of the ledger and obey
  it. It authorises only what it says: "commit at checkpoints" is a commit grant, nothing more.
- The dump ends at "that's it", "summarize", "plan", "what's the plan", or "go".

## 2. Triage each item

For every ledger entry, before any ticket exists:

1. **Search first.** `similar_issues` with the title, and `list_issues` with a keyword in project
   *Organic LLM*. An existing ticket gets an update or a comment, not a duplicate.
2. **Classify:** new work · existing ticket to update · decision or locked preference (record it
   per [maintenance protocol](../../../docs/hub/maintenance-protocol.md); strategy goes to
   `organic-llm-hub/`, never `docs/`) · open question for the owner · explicitly deferred ("leave
   503 out for now": comment on the ticket and leave it unplanned).
3. **Flag the ask-first cases** from AGENTS.md. They become open questions, not scope: a new
   dependency; an architectural change (needs a proposal in `organic-llm-hub/decisions/`); a
   design value no token provides (the three-way token question); a major version bump;
   anything that would need a server started or a commit the owner has not authorised.
4. **Never resolve a question by assumption.** If their words leave a fork, list it with options
   and your recommended default, and let them close it.
5. Read the area's doc before sizing it: [`docs/hub/README.md`](../../../docs/hub/README.md) for
   product work, [`docs/design/README.md`](../../../docs/design/README.md) for anything they see.

## 3. Plan

- **One parent story** ("Tonight: settings overhaul") with **child tickets** that are each one
  reviewable slice with a done-when. Group by who owns which files so children can run in
  parallel without colliding; note which can be delegated.
- **Estimate agent minutes** (`estMinutes`), never human days: the owner said "you're developing
  it, not me". Count your own edit, test and verify time. A small tweak is minutes, a feature
  with tests is tens of minutes. Their review and CI wait are separate; say so once.
- Set `blockedBy` for real dependencies only. Set `plannedAt` to today for what they said is
  tonight; leave the rest unplanned.
- Priority only when they gave one. Labels from `Bug`, `Feature`, `Improvement`.

## 4. File it in Ergon

Team **Coalescence Labs** (`COA`), project **Organic LLM**, unless the dump names another.

1. `intake` with `dryRun: true`, `text` = the verbatim ledger, `context` = your triage notes
   (existing ticket ids to update, items to leave unplanned, the standing instructions),
   `team: "COA"`, `project: "Organic LLM"`, `source: "claude-code"`. It costs one model call per
   plan, so **edit the returned plan yourself**; do not re-plan to tweak a title.
2. Review `plan.operations` against step 2: duplicates become `update` or `comment`; strip any
   operation that would settle an open question by assumption; fix titles to the outcome, parents,
   `estMinutes`, `plannedAt`, `blockedBy`.
3. Answer the plan's `questions` only from the owner's own words. Anything else stays open.
4. File by passing the reviewed `plan` back to `intake`. It is filed exactly as given, with no
   second model call.
5. State: new tickets **Todo** (or **Backlog** if unplanned). Do not set **In Progress** until work
   starts, and never **Done** from a plan.
6. If the plan needs more than ticket text (sequencing, a parallel map, the cut line), save one
   document with `save_document` (`kind: "notes"`, `issues: [...]`, project *Organic LLM*) that
   **links** to the tickets instead of restating them. Open questions go in a second document,
   `kind: "open-questions"`, one clause per question with its options and your default, so
   `list_open_questions` finds them.
7. Keep private detail out of anything that will reach the public repo or a PR.

## 5. Present: one screen

Concise, scannable, no filler. The owner has said "too many words" before.

```
Tonight: <parent>  ·  ~<N> min of agent time, <M> in parallel
| # | Item | Ticket | Est | Parallel | Needs you |
Needs your call (each with my default):  1) …  2) …
Ask-first flags:  …
Cut line: <what fits if time is short>
```

Then stop and wait. If they gave no time budget, ask for one in a single line.

## 6. On "go"

Work each ticket through [ship-from-brief](../ship-from-brief/SKILL.md) (state **In Progress**,
branch from the issue, PR to `develop`), or [pr-checkpoints](../pr-checkpoints/SKILL.md) if they
asked for incremental delivery. Delegates go to disjoint paths; file claims with
[agent-radar](../agent-radar/SKILL.md) first. Keep Ergon in step as you go: progress, decisions,
blockers, scope changes. Further dump items after "go" join the ledger and the plan the same way,
as updates.

If Ergon is unavailable, keep the ledger and plan locally, say plainly what is unsynced, and never
claim a ticket exists that you could not confirm.
