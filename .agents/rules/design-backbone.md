---
paths:
  - "components/**/*.tsx"
  - "styles/**/*.css"
  - "lib/chat/**/*.ts"
  - "lib/homepage/**/*.ts"
  - "lib/rabbit-holes/**/*.ts"
  - "lib/rabbit-holes/**/*.tsx"
  - "app/sandbox/prototypes/**/*.tsx"
  - "app/sandbox/prototypes/**/*.ts"
  - "app/sandbox/prototypes/**/*.css"
  - "docs/design/**/*.md"
---

# Design backbone

Before changing motion, typography animation, chat loading / status labels, spacing/density, sizes, or related UI feel:

1. Read [`docs/design/README.md`](docs/design/README.md) and the matching topic doc under `docs/design/`.
2. For stack/gap/inset spacing, follow [`docs/design/spacing.md`](docs/design/spacing.md) — extend `lib/design-tokens/spacing.ts` and `@theme` primitives, not one-off `space-y-*` in components.
3. For character-level / stagger / processing-label timing, follow [`docs/design/motion-and-text-timing.md`](docs/design/motion-and-text-timing.md) — keep TS constants and CSS `--ptb-*` vars in sync.
4. Prefer functional, brief motion; exits faster than entrances; honor `prefers-reduced-motion`.
5. Do not invent one-off duration/stagger values in JSX; extend shared timing modules.
6. Verify feel in the relevant sandbox lab when one exists (e.g. `/sandbox/prototypes/llm-states`).
7. If you change approved timings or principles, update the design doc in the same change.
8. **Tokens, never literals.** Take every spacing, gap, inset, size, radius, color, type and timing
   value from the design tokens: the `@theme` primitives in `styles/globals.css`,
   `lib/design-tokens/`, the Tailwind scale the codebase already uses (`min-h-11`, `size-9`,
   `gap-inline-sm`), and the shared timing modules. Do not write raw `px`/`rem`/hex values, a
   `calc()` built from them, or a "close enough" nearby token. Match how the surrounding file
   expresses it. Prototype and sandbox files are held to this too.
9. **When the request does not fit the tokens, ask; do not improvise.** If what the user wants
   needs a value no token provides (a 4px gap where the inline scale starts at 8px, a 36px control
   where the system's target is 44px), or breaks a documented guideline, stop and ask before
   writing it. Put the question to the user as a prompt (`AskUserQuestion`) with the options:
   (a) change an existing token, naming it and the places it affects; (b) add a new token, with a
   proposed name and value; (c) a documented one-off exception. State which guideline it strains.
   Do not pick a literal, borrow a token from another role (a `stack-*` value as an inline gap),
   or go below a documented minimum on your own. Once the user decides, update the token and
   `docs/design/spacing.md` (or the matching doc) in the same change.
