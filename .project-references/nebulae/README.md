# Project Nebulae

A sandbox for prototyping components, flows, and agent behaviors.

## What is Nebulae

Nebulae is a **long-lived component lab**, not a single product. It's designed to host:

- Small, focused UI components
- Rich interaction flows and micro-interactions
- Agent UIs and prompt/behavior patterns
- Reusable design patterns and archetypes

Everything in Nebulae is product-agnostic and domain-agnostic. The goal is to build a flexible, curated library of explorations that can evolve and be reused across projects.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Runtime:** Bun
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + CSS custom properties
- **UI Primitives:** shadcn/ui
- **React Compiler:** Enabled by default

## Structure

```
src/
├── foundations/       # Core design tokens and utilities
│   ├── theme/        # Colors, spacing, motion, typography tokens
│   ├── layout/       # Layout primitives (stacks, shells, panels)
│   └── utils/        # Generic utilities (no product logic)
├── components/
│   ├── base/         # Atomic primitives (buttons, text, surfaces)
│   └── composed/     # Opinionated compositions
├── experiments/      # Self-contained explorations
├── patterns/         # Promoted experiments with stable APIs
docs/                 # Repo-level documentation
notes/                # Free-form notes and thinking
```

## Experiment → Pattern Lifecycle

**Experiments** are self-contained explorations living in `src/experiments/[name]/`. They can be visually expressive, interactive, and exploratory.

When an experiment proves reusable and stabilizes, it can be **promoted to a pattern** in `src/patterns/`. Patterns have:

- Clear, typed, documented APIs
- Clean separation of layout, state, and content
- No experiment-specific hacks or one-off conditions

Not all experiments become patterns. That's intentional.

## Getting Started

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the lab.

Navigate to experiments via the home screen or directly at `/experiments/[experiment-name]`.

## Documentation

See `docs/` for:

- `overview.md` — Project philosophy and mental models
- `conventions.md` — Naming, structure, and lifecycle guidelines
- `agent.md` — AI assistant behavior and boundaries
- `links.md` — Curated official documentation links
