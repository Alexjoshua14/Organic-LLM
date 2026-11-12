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

## Shared palette

`styles/CodePalette.css` holds the one light and one dark palette and the Prism token colors, under
the global class `organic-code`. The code block and the code diff block both put that class on their
root, so a palette change happens in one place. Dark follows the app's `.dark` class.

## Code diff block

`components/chat/gen-ui/blocks/CodeDiff.tsx` renders on the same palette: Fira Code at 13px with
1.6 leading, syntax-colored lines (language from the file extension), the changed span emphasised
by tint and weight on top of the tokens, and unchanged-line folds as quiet separator rows. This is
a restyle only. The schema, the tool description and the agent contract are unchanged.

## Highlighting

`code-highlight.tsx` uses the Prism light build of `react-syntax-highlighter` with class-based output
(`token keyword`). The palette does the coloring, so theme switching is pure CSS.

- **Bundled (18, always ready):** bash, c, cpp, css, diff, go, java, javascript, json, jsx, markdown,
  markup (HTML/XML), python, rust, sql, tsx, typescript, yaml.
- **On demand (34, one chunk each, 2 to 5 KB gzipped):** C#, Ruby, PHP, Swift, Kotlin, Scala, Dart,
  Lua, Perl, R, Haskell, Elixir, PowerShell, Dockerfile, TOML, INI, GraphQL, SCSS, Less, Makefile,
  Objective-C, Protobuf, HCL, Zig, Julia, Clojure, OCaml, Groovy, Nginx, HTTP, Solidity, Vim, LaTeX.
  The block renders as plain text until the grammar arrives, then colors in place; a loaded grammar
  stays registered for the session. A failed chunk leaves the block plain.

Add a language: add its import to `LAZY_GRAMMARS` (or `GRAMMARS` if it is hot enough to bundle),
a `LABELS` entry, `ALIASES` for common fence names, and `EXTENSIONS` for diff paths. A test loads
every listed language, so a bad import fails CI.

Cost is about 0.05 ms per line (measured on the server renderer: 1.5 ms for 20 lines, 5.6 ms for
100, 23 ms for 400). A streaming reply re-renders its last block on every token, so blocks over 60
lines stay plain while they change and are colored 150 ms after the text settles. A block that
mounts complete is colored at once. Re-measure before raising `HIGHLIGHT_EAGER_LINES`.

## In the Gen UI Lab

The lab's **Code** page (lab-only, like Diagram) steps through eight presets with the same prev/next
toolbar the comparison uses: Snippet, Reference, Command, Long lines, Languages, Plain, Long block
and Diagram fence. Each preset is a complete markdown message rendered by the real chat markdown
renderer, so it exercises exactly what chat ships. The code diff block has its own eight fixtures.

## Not yet

- The diff block has no Changes / Result toggle: its files are partial hunks, so a "result" view
  would show only fragments. Add it only with a defined meaning for multi-file diffs.
- Explain mode (explanations anchored to lines) is design-only. It needs an agent contract and an
  approved proposal before it ships.
