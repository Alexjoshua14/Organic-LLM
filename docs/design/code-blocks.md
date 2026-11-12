# Code blocks

**Locked owner direction — 2026-11-12.** The second-pass design from the code primitives study
(`app/sandbox/prototypes/code-primitives`) is the default code block. The original block is gone,
not kept as a fallback.

## What ships

`components/shared/code-block.tsx` is the one fenced-code component. Chat markdown, gen-ui markdown,
blog prose and the rabbit-hole article all use it. It owns its appearance; callers pass only
`wrap` and `containerClassName` (spacing). Do not pass border, background or padding classes.

- **Header:** language label and line count on the left; wrap toggle and a copy control on the
  right. The copy control reserves its width (`9em`) so Copy code / Copied / Copy failed never
  shift the toolbar.
- **Body:** 13px source at a 20.8px line height (1.6), Fira Code with a monospace fallback, subtle
  indentation guides, hanging indent when wrapped, a line-number gutter from five lines up.
- **Palettes:** one light and one dark set in `code-block.module.css`. Dark follows the app's
  `.dark` class. The app never sets `color-scheme`, so `light-dark()` would resolve to light.
- **Font:** the block mounts `fontMono.variable` on its own root. The root layout is untouched.
- **Mermaid:** a `language-mermaid` fence keeps its diagram and gets no code chrome.
- **Unknown or missing language:** plain lines, same layout, no tokens.

## Highlighting

`code-highlight.tsx` uses the Prism light build of `react-syntax-highlighter` with an explicit
grammar list (bash, c, cpp, css, diff, go, java, javascript, json, jsx, markdown, markup, python,
rust, sql, tsx, typescript, yaml) and class-based output (`token keyword`). The palette does the
coloring, so theme switching is pure CSS. Add a language by importing its grammar and, if it has
common aliases, extending `ALIASES` and `LABELS`.

Cost is about 0.05 ms per line (measured on the server renderer: 1.5 ms for 20 lines, 5.6 ms for
100, 23 ms for 400). A streaming reply re-renders its last block on every token, so blocks over 60
lines stay plain while they change and are colored 150 ms after the text settles. A block that
mounts complete is colored at once. Re-measure before raising `HIGHLIGHT_EAGER_LINES`.

## Not yet

- The code-diff Gen UI block still has its own styling; it moves to this design next.
- Explain mode (explanations anchored to lines) is design-only. It needs an agent contract and an
  approved proposal before it ships.
