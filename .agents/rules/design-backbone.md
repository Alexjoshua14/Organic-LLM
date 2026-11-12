---
paths:
  - "components/**/*.tsx"
  - "styles/**/*.css"
  - "lib/chat/**/*.ts"
  - "lib/homepage/**/*.ts"
  - "lib/rabbit-holes/**/*.ts"
  - "lib/rabbit-holes/**/*.tsx"
  - "app/sandbox/prototypes/**/*.tsx"
  - "docs/design/**/*.md"
---

# Design backbone

Before changing motion, typography animation, chat loading / status labels, spacing/density, or related UI feel:

1. Read [`docs/design/README.md`](docs/design/README.md) and the matching topic doc under `docs/design/`.
2. For stack/gap/inset spacing, follow [`docs/design/spacing.md`](docs/design/spacing.md) — extend `lib/design-tokens/spacing.ts` and `@theme` primitives, not one-off `space-y-*` in components.
3. For character-level / stagger / processing-label timing, follow [`docs/design/motion-and-text-timing.md`](docs/design/motion-and-text-timing.md) — keep TS constants and CSS `--ptb-*` vars in sync.
4. Prefer functional, brief motion; exits faster than entrances; honor `prefers-reduced-motion`.
5. Do not invent one-off duration/stagger values in JSX; extend shared timing modules.
6. Verify feel in the relevant sandbox lab when one exists (e.g. `/sandbox/prototypes/llm-states`).
7. If you change approved timings or principles, update the design doc in the same change.
