# Linking conventions

How canon in one system points at canon in another without duplicating it. Established now so
that Linear slots in without a migration. Notion is already live.

See [ownership.md](./ownership.md) for which system owns what.

## Referencing a spec

Use a repo-relative path plus a durable anchor:

```
spec: organic-llm-hub/speak/product-spec.md#AC-3
spec: docs/speak/tool-behavior.md#memory-search
```

Anchor on **durable IDs** (`AC-3`, `SM-1`, `EVAL-2`), not on heading text. Headings get
rewritten; IDs are a contract. Never renumber an ID — retire it and add a new one.

## Crossing the public/private line

The repo is public and `.context/` is not. Links across that boundary follow one rule:
**public may name a private path; public may not summarize private content.**

| Direction | Allowed | Example |
|-----------|---------|---------|
| Public → private | Name the path so agents know to look | "Product intent lives in `organic-llm-hub/speak/product-spec.md`" |
| Public → private | ❌ Restate what it says | "Intent is to beat X on latency" — leaks the content |
| Private → public | Normal relative links | `../../docs/speak/tool-behavior.md` |

Private docs carry this header so a misplaced copy is obvious on sight:

```markdown
> **PRIVATE** — intent repo. Do not move into `Organic-LLM/docs/` or any public surface.
```

## Linear issues (Phase 3+)

Every issue carries both fields when they apply:

```
notion: <url to the relevant Notion page, if any>
spec:   <repo-relative path with anchor>
```

Rules:

- **Do not duplicate spec content in the issue body.** The issue says what to do and links to
  why; the spec is the contract.
- Issues referencing private specs use the path form — the path is not itself sensitive.
- Every Linear project description links back to its Notion page and its spec path.

## Notion (live)

- Every PRD's **first line** links to the Linear project.
- Every hub page links to the repo path holding the corresponding operational canon.
- Notion holds the "why"; it does not hold acceptance criteria. Those live in the spec.

## ADRs

Path: `docs/<feature>/decisions/YYYYMMDD-short-title.md`

```
docs/speak/decisions/20260812-webrtc-transport.md
```

- Date is the **decision** date, not the file's last edit.
- Title is kebab-case and describes the decision, not the topic —
  `20260812-webrtc-transport.md`, not `20260812-transport-options.md`.
- ADRs are public by default. If the reasoning is strategic, record the decision in the ADR and
  the strategic why in `organic-llm-hub/`, then link.
- ADRs are append-only. Superseding an ADR means writing a new one that links back and marks
  the old one `Superseded by <path>` — never rewriting history.

## Feature doc layout

Every workstream follows the same shape, so agents can navigate one they have never seen:

```
docs/<feature>/                    # public — operational
├── README.md                      # what it is, code paths, current state, links
├── <behavior>.md                  # locked behavioral rules
└── decisions/                     # ADRs

organic-llm-hub/<feature>/            # private — intent
├── product-spec.md                # problem, scope, ACs, success metrics, roadmap
└── open-questions.md              # unresolved product direction
```
