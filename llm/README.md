# `llm/`

Shippable libraries and tooling intended to be **published independently** (for example as npm packages) while staying easy to vendor or extract into their own git repository.

## Layout

| Path | Purpose |
|------|---------|
| [`morph-physics/`](./morph-physics/) | **`@organic-llm/morph-physics`** — spring-driven layout morphing (ported from Project Nebulae). Build: `cd morph-physics && bun run build`. |
| [`.plans/`](./.plans/) | Planning docs for work in this tree |

## Plans

- [Morph physics → npm package](.plans/morph-physics-npm-package.plan.md)

When this subtree moves to a dedicated repository, keep the same **`llm/`** top-level convention so multiple packages can live under `llm/<package-name>/`.
