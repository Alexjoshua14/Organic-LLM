---
paths:
  - "app/sandbox/subagents/cards/**"
  - "app/sandbox/arcadia/_components/subagent-card.tsx"
  - "app/sandbox/arcadia/_components/subagent-swipe-row.tsx"
  - "app/sandbox/arcadia/_components/subagent-speak-glass-bar.tsx"
  - "tests/unit/subagent-card-lab.test.tsx"
---

# Subagent card lab

Before changing the subagent card, read [`docs/design/subagent-card-lab.md`](docs/design/subagent-card-lab.md).

- Design changes go to the `next-*` files in `app/sandbox/subagents/cards/_components/` only. Never apply the same edit to the live card in `app/sandbox/arcadia/_components/`.
- "Promote" copies Next over Current. Next and the lab stay in place; never delete them.
- Shared files (Speak glass bar, `components/voice/*`) get opt-in props so Current is unchanged until promotion.
