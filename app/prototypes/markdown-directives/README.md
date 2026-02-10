# Extended Markdown Directive System — Prototype

MVP for the **Extended Markdown Directive Syntax** (see project `docs/SYNTAX_ARCHITECTURE.md`). This folder is self-contained; no changes to main app chat or markdown rendering.

## Flow

1. **Input:** Raw markdown string (e.g. from an LLM stream) containing directives like `::knowledge-card{ query="project alpha" limit="5" }`.
2. **Parse:** `remark-directive` turns `::name{ key="value" }` into mdast nodes (`leafDirective` / `textDirective` / `containerDirective`).
3. **Transform:** A remark plugin sets `node.data.hName` and `node.data.hProperties` so `remark-rehype` emits custom elements (e.g. `<knowledge-card>` with attributes).
4. **Render:** `ReactMarkdown` uses a `components` map to replace those elements with React components from the registry.
5. **Resolve:** Each directive component can call a resolver (e.g. mock) to fetch data by props and render the UI.

## Folder roles

| Path | Role |
|------|------|
| `_lib/remarkDirectives.ts` | Remark plugin: directive nodes to HAST-ready (hName / hProperties). Optional prop parsing/validation. |
| `_lib/componentRegistry.ts` | Maps directive names (e.g. knowledge-card) to React components. |
| `_lib/mockResolver.ts` | Simulates async data resolution for directive props (no real backend). |
| `_components/DirectiveRenderer.tsx` | Wraps ReactMarkdown with directive plugin(s) and component overrides; fallback for unknown directives. |
| `_components/KnowledgeCard.tsx` | Example directive component (uses mock resolver). |
| `_components/Timeline.tsx` | Example directive component. |
| `_components/DataTable.tsx` | Example directive component. |
| `page.tsx` | Demo page: sample markdown with directives, rendered via DirectiveRenderer. |

## How to extend

- **New directive:** Implement a React component that accepts props (from the directive attributes), add it to `_lib/componentRegistry.ts`, and (optionally) add mock data in `_lib/mockResolver.ts`.
- **Integration with chat later:** Reuse the same plugin and registry in the main chat markdown pipeline, or import DirectiveRenderer where assistant markdown is rendered.
