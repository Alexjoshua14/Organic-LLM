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

One **Code** page (the code diff block's page, labelled Code in the lab nav) covers both ways code
reaches chat, because they share one set of primitives. It steps through eight slides with the same
prev/next toolbar the comparison uses:

- **Snippet:** a fenced block in a markdown reply, through the real chat renderer. One block at a time.
- **Diff:** the same language as the unified diff a model sends, through the registry. The app finds
  the language from the file path.
- **Fixture:** the page's schema fixture, which "Generate with AI" replaces (the lab jumps here after
  generating).
- **Reference, Command, Long lines, Plain, Long block:** fenced blocks for layout checks.

Snippet and Diff have a **language dropdown** and a **Shuffle** toggle. Languages are never listed
together. `_fixtures/language-samples.ts` holds one real change per supported language, used as the
diff the model would send and as the fenced snippet. Shuffle visits every language once per round
in random order and never repeats one back to back; it pauses on hover, focus, a hidden tab and
reduced motion, runs only while Snippet or Diff is showing, and picking by hand stops it. Diagram
fences have their own lab page.

### On a phone

Below 56rem (a container query on the lab root, not the viewport) the lab is the focused component
and the dot rail, nothing else: the control column (title, archetype list, rendering states,
Generate with AI, Reset fixtures, /btw) is hidden, and so is the narrow-only preview picker it
replaced. The rail is a quiet pill of bare dots at the right edge with 28px tap targets (no labels:
a phone has no hover); the stage keeps 32px clear of it. On touch devices the lab's own controls
(preset arrows, Auto, language picker, Shuffle) grow to 44px. Gallery snapping stays `mandatory`
with `scroll-snap-stop: always` on touch too, so one quick swipe moves exactly one section (an
earlier `proximity` override let flicks settle between pages); a page taller than the screen still
scrolls freely inside itself. A section's own toolbar stays, since
that is how you operate the component in focus. The jsdom tests guard the class contract; layout
itself needs a look on a real phone or a narrow window.

## On a phone (the blocks themselves)

Checked in a browser at 390px (iPhone 12 Pro) against the lab, 2026-11-12.

- **Wrap by default** at 40rem and below (`use-code-wrap.ts`, `CODE_NARROW_QUERY`). A phone shows
  about 25 columns, so a hanging indent beats sideways scrolling. `data-wrap="auto"` lets CSS wrap
  from the first paint (no flash on server-rendered blog and rabbit-hole pages); once the reader
  presses Wrap lines their choice holds at every width. The CSS repeats the wrapped rules under the
  same media query, because a query cannot sit inside a selector: keep the two in step.
- **A glance, then a reader.** The inline block on a phone is for recognising code, not studying
  it. It drops the line-number gutter, shows about 14 lines (a height cap with a fade) and ends in
  **Show all N lines**; blocks of five lines or more also get an Expand icon in the header. Both
  open the reader. A short snippet has nothing to open. The cap and the gutter are CSS under the
  40rem query (`data-glance`, `data-capped`), so a server-rendered block never flashes; JS only
  decides which blocks are long, from their content (`GLANCE_LINES` in `code-block.tsx` and the
  `14` in `code.module.css` are the same number: keep them in step).
- **The reader** (`code/code-reader.tsx`, shared by the block and the diff) is a full-screen
  Radix dialog portalled to the body: line numbers, sideways scrolling by default with a Wrap
  toggle, and a six-step text size (11 to 18px, default 13, remembered in `localStorage`). Close is
  labelled at the top; Wrap, text size and Copy sit at the bottom within thumb reach. Escape and
  the back gesture close it (a history entry with its own `codeReader` key, so it never collides
  with the diagram takeover), and focus returns to the control that opened it. It renders the live
  text, so a streaming block keeps growing inside an open reader.
- **Wrap in the glance:** the glance still wraps by default (`data-wrap="auto"`, see above), so
  nothing needs a sideways gesture inside a page that scrolls vertically. The inline Wrap toggle is
  hidden on a phone because the reader owns it.
- **Type scales from `--code-size`** (13px, 12.5px on a phone, the reader's choice there); line
  height is 1.6 of it and the gutters are in `em`, so a larger reader size keeps everything aligned.
- **One-row header:** language and line count give way (ellipsis) before the controls do; the file
  icon is dropped. Copy is icon-only inline (its label stays for assistive tech, the check icon is
  the confirmation) and labelled in the reader. Controls are 36px, 44px on a touch device.
- **Diff:** the file section is a `minmax(0, 1fr)` grid, so a wide table scrolls in its well and
  never widens the card (it used to push the copy button off-screen). A file longer than 14 rows
  gets the same glance (no old/new number columns, capped, **Open the full diff**) and opens in the
  same reader with its numbers, hunk heads and comments. On a phone the status word is spoken but
  not drawn (the mark, tint and counts already say it) and hunk heads are slim dividers.
- **Diagram:** an inline diagram shrinks to its well down to 75% of natural size (labels stay
  ~10px or more), then scrolls from its left edge; the old centred-flex scroller clipped the left
  edge out of reach. Expand is always visible (no hover on touch), and copy and download hide.
  The node menu stays inside the viewport. The expanded view keeps natural size and pans.
- **Comparison:** the plot is a fixed 600-unit drawing, so its labels are larger in narrow
  containers; legend, criterion chips and the select are 44px on touch.
- **Lab:** the preset's intent line and the language count are hidden on a phone.

## Not yet

- The diff block has no Changes / Result toggle: its files are partial hunks, so a "result" view
  would show only fragments. Add it only with a defined meaning for multi-file diffs.
- Explain mode (explanations anchored to lines) is design-only. It needs an agent contract and an
  approved proposal before it ships.
