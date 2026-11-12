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

## One code family

The code block and the code diff block are built from the same primitives in
`components/shared/code/`; there are no parallel copies.

- `CodeSurface`: the framed well (palette, Fira Code on the surface itself, border, radius, wrap).
- `CodeScroll`: the named, keyboard-focusable scroll region (focus is `organic-focus`, never a ring).
- `CodeTable`, `CodeRow`, `CodeMetaRow`, `CodePlain`: the line table. A row has optional old/new
  gutters, an optional named +/− cell, and a `<code>` carrying the tokens and indentation guides.
  Diff rows add the markers and tints through `data-kind`; hunk heads, folds and comments stay
  diff-owned and render inside the same table body.
- `CodeCopyButton`, `CodeWrapButton`: the header actions. Copy reserves its width so Copy / Copied
  / Copy failed never shift the toolbar, and announces through a status region.

Syntax tokens come from `code-highlight.tsx` for both: `CodeLines` for a block, `HighlightedText`
for a diff line.

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
- **On demand (33, one chunk each, 2 to 5 KB gzipped):** C#, Ruby, PHP, Swift, Kotlin, Scala, Dart,
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

## Limits and safety

Highlighting is regex work on the main thread, so its input is bounded (`HIGHLIGHT_LIMITS`):

- A block over 100,000 characters or 2,500 lines renders as one plain text node, still copyable,
  with a note in the header. Nothing is tokenized and no per-line DOM is built.
- A diff line over 5,000 characters is not tokenized, but keeps its changed-span emphasis.
- Languages, labels and file extensions are looked up with own-property checks, so a fence or path
  named `constructor` or `__proto__` cannot reach inherited properties. Non-string values are
  ignored. An unknown fence label is cut to 24 safe characters before it reaches the header.
- If a grammar throws, the block falls back to the same text, uncolored.
- Code is only ever rendered as React text, never as markup.

## In the Gen UI Lab

The lab's **Code** page (lab-only, like Diagram) steps through six presets with the same prev/next
toolbar the comparison uses: Snippet, Reference, Command, Long lines, Plain and Long block. One code
block at a time; languages are switched from the dropdown in the Snippet slide, never listed
together. Diagram fences have their own lab page. Each preset is a complete markdown message rendered by the real chat markdown
renderer, so it exercises exactly what chat ships. The code diff block has its own eight fixtures.

Both the Code page's Snippet slide and the first code diff page have a **language picker** and a
**Shuffle** toggle. `_fixtures/language-samples.ts` holds one real change per supported language,
used as the diff the model would send and as the fenced snippet. Shuffle visits every language once
per round in random order and never repeats one back to back; it pauses on hover, focus, a hidden
tab and reduced motion, and picking by hand stops it.

## Not yet

- The diff block has no Changes / Result toggle: its files are partial hunks, so a "result" view
  would show only fragments. Add it only with a defined meaning for multi-file diffs.
- Explain mode (explanations anchored to lines) is design-only. It needs an agent contract and an
  approved proposal before it ships.
