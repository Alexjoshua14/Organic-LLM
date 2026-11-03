# Subagent card lab

This folder is the Current vs Next comparison page for the multiagent view's subagent card.
Canon: [`docs/design/subagent-card-lab.md`](../../../../docs/design/subagent-card-lab.md). Read it
before editing anything here or the live card in `app/sandbox/arcadia/_components/`.

- Design changes go to the `next-*` files in `_components/`. Never apply the same edit to the live
  `subagent-card.tsx` or `subagent-swipe-row.tsx`.
- "Promote" copies Next over Current. Next and this page stay in place; never delete them.
- Shared files (the Speak glass bar, `components/voice/*`) get opt-in props so Current is unchanged
  until promotion.
