# Overview

## What Nebulae Is

Nebulae is a **component lab** — a long-lived sandbox for prototyping UI components, interaction patterns, and agent behaviors.

It's not a product. It's not an app. It's a curated collection of explorations that can be reused, remixed, and evolved over time.

### Core Purpose

- **Experiment freely:** Test ideas without product constraints
- **Build reusable patterns:** Promote successful experiments into stable archetypes
- **Stay navigable:** Keep structure clear as the lab grows
- **Preserve quality:** Maintain readability and intent-revealing code

## What Belongs Here

✅ **Does belong:**

- UI components (base primitives, composed components)
- Interaction flows and micro-interactions
- Agent UIs and prompt patterns
- Design system foundations (tokens, layout primitives)
- Reusable patterns and archetypes

❌ **Doesn't belong:**

- Product-specific business logic
- Domain-specific data models
- One-off scripts or utilities tied to a specific project
- Large datasets or generated assets

## Navigation Model

### Foundations

Start here for design tokens, layout primitives, and generic utilities. These are the building blocks everything else uses.

### Components

Base primitives live in `components/base/`. Opinionated compositions live in `components/composed/`. Both are product-agnostic.

### Experiments

Self-contained explorations. Each experiment has its own folder and can be as visually expressive or interactive as needed. Not all experiments need to become patterns.

### Patterns

Promoted experiments with stable APIs. These are archetypes meant to be reused. They should have clear documentation and clean separation of concerns.

## Philosophy

**Readability first.** Code should be easy to scan and understand.

**Aesthetic matters.** This is a design and interaction lab. How things feel is part of the work.

**Extensibility over abstraction.** Favor patterns that can evolve. Avoid premature generalization.

**Minimal dependencies.** Prefer the existing stack and standard library.

**Long-lived and curated.** This repo is meant to grow thoughtfully, not chaotically.
