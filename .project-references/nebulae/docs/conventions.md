# Conventions

## Naming

### Experiments

Use descriptive, kebab-case folder names that reveal intent:

✅ Good:

- `hello-surface`
- `flow-panel-orbit`
- `timeline-scroll-playhead`
- `agent-command-surface`

❌ Avoid:

- `test`
- `playground2`
- `misc-stuff`
- `experiment-1`

### Patterns

Pattern names should describe the archetype:

✅ Good:

- `layout-shell-pattern`
- `command-surface-pattern`
- `panel-stack-pattern`

### Components

Use PascalCase for component names. Be specific and intent-revealing:

✅ Good:

- `Button`, `Surface`, `Panel`
- `CommandPalette`, `TimelinePlayhead`

## Experiment Structure

Each experiment lives in its own folder under `src/experiments/[name]/`:

```bash
src/experiments/hello-surface/
├── page.tsx           # Entry point (Next.js App Router convention)
├── README.md          # Optional: purpose, interactions, open questions
└── components/        # Optional: experiment-specific components
```

### Experiment Guidelines

- Keep experiments self-contained
- Can be visually expressive and exploratory
- Code must still be readable and navigable
- Add a `README.md` if the experiment explores a non-obvious concept

## Pattern Structure

Patterns are promoted experiments with stable APIs:

```bash
src/patterns/command-surface-pattern/
├── index.tsx          # Main export
├── types.ts           # Type definitions
├── README.md          # API documentation
└── examples/          # Optional: usage examples
```

### Pattern Requirements

When promoting an experiment to a pattern:

1. Define a clear, typed API
2. Document props and behavior
3. Separate layout, state, and content concerns
4. Remove experiment-specific hacks
5. Add usage examples if the pattern is non-trivial

## Promoting Experiments to Patterns

Not all experiments become patterns. Promotion criteria:

- **Reusability:** Has the pattern been useful in multiple contexts?
- **Stability:** Has the API settled into a clear shape?
- **Generality:** Can it work without experiment-specific assumptions?
- **Documentation:** Can the pattern be explained clearly?

When promoting:

1. Propose the promotion explicitly (don't silently move files)
2. Suggest API/props design
3. Update relevant docs
4. Keep the original experiment until confirmed for removal

## Component Categorization

### Base Components (`components/base/`)

Low-level primitives. Examples:

- `Button`, `Input`, `Text`, `Surface`
- Generic, composable, minimal opinions

### Composed Components (`components/composed/`)

Opinionated components built from base components. Examples:

- `CommandPalette`, `ModalShell`, `CardStack`
- More specific use cases, but still product-agnostic

## File Organization

- Use `index.tsx` or `page.tsx` as entry points
- Co-locate related utilities, types, and components
- Keep files focused and reasonably sized
- Use short `// NOTE:` or `// TODO:` comments for local intent
- Move conceptual explanations into markdown docs

## Documentation Style

- Concise and high-signal
- Architectural, not verbose
- Short bullet lists over long paragraphs
- Examples over abstract explanations
