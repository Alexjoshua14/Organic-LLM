---
name: pr-checkpoints
description: Deliver Organic LLM changes through working checkpoints in one reviewable PR, with Ergon progress, refreshed preview deployments, and a final demo and review handoff. Use when the user requests incremental PR delivery or wants to follow implementation through preview builds.
---

# PR checkpoints

Let the user follow useful, running increments without depending on the active chat.
Read the repository's `AGENTS.md` and [contribution guidance](../../../CONTRIBUTING.md)
for authority, checks, and the target branch. This skill does not grant permission to
commit, start a server, deploy production, or merge; use the user's existing authorization.

- Find the related PR and Ergon issue before creating another. Use a parent story and
  child issues when the work has distinct parts. Respect the user's requested PR scope.
- With commits/pushes authorized, publish the first coherent working increment as a
  draft PR. Push subsequent working checkpoints to that same branch. A preview deployment
  can then refresh while implementation continues. Do not promise deployment success:
  report the actual state or leave it explicitly pending.
- Run checks appropriate to each increment. Keep incomplete features out of advertised
  behavior, and label unfinished scope and validation clearly in the draft description.
  Include only intended files; preserve unrelated work and never push private material.
- After a checkpoint, update Ergon with the PR link, what is usable, what remains,
  and material failures. Give brief thread updates at meaningful checkpoints; do not
  produce empty commits or a stream of status-only comments.
- Keep the PR body about the current final scope. Explain the problem, changed behavior,
  why it helps, confirmed fixes, and useful implementation boundaries. Make it readable
  for a public reviewer who has not seen the conversation. Exclude private context,
  credentials, internal hostnames, and unrelated work history.
- Include a **demo path**: route, necessary setup, a copy/paste starter prompt using
  synthetic content, and a short sequence of actions with expected visible results.
  Exercise the actual work, including stop/error/recovery paths when relevant. State
  real limitations rather than promising unverified model behavior.
- Before marking ready, run the repository's required checks, review the diff, and verify
  the requested review environment. Start a local server only when authorized, on the
  requested port, without replacing an existing listener. Distinguish a local production
  build from the hosted daily driver.
- Push the final checkpoint, update the PR body and readiness, and put a review handoff
  in Ergon: PR/preview or local URL, completed scope, validation, demo, and any remaining
  uncertainty. Keep unresolved bugs open and linked. Notify the user once ready.

Use the runtime's PR-linking tool when available after creating or pushing the PR.
Leave merging to the user's review unless separately authorized.
