# Blog layout

How `/blog` is composed: the article shell, the reading measure, the index and the cards. The
posts' words are not here; their home is `content/blog/` and `lib/blog/posts.ts`.

## One shell, many frames

`app/blog/layout.tsx` only starts content at the top of the page (`Page` centres vertically by
default, which floats short pages and clips long ones). Width belongs to the page frame:

| Page | Frame | Why |
|------|-------|-----|
| Article | `PageContentFrame maxWidth="8xl"` via `BlogArticleShell` | Room for the reading column, wide figures and the rail |
| Blog and surfaces index | `maxWidth="7xl"` | A 12-column bento needs breadth, not a 90rem sprawl |

`8xl` is a theme container (`--container-8xl: 90rem` in `styles/globals.css`), so `max-w-8xl` and
the `@8xl` container variant both exist.

## Container queries, not viewport queries

Every step follows the **page frame** (`@container`), not the screen. With the sidebar open the
page is narrower than the viewport, and a viewport breakpoint would lay out for space that is not
there.

| Frame width | Article | Index |
|-------------|---------|-------|
| any | One reading column, capped at the measure | One column |
| `@xl` (36rem) | | Two columns |
| `@3xl` (48rem) | | Bento: 12 columns, feature spans two rows |
| `>= 64rem` | Figures step out to the wide measure | |
| `@6xl` (72rem) | | Four-column grid below the bento |
| `>= 80rem` | A sticky "On this page" rail appears | |

## The reading measure

`--blog-measure: 42rem` is about 70 characters of Satoshi at the body size. Wider and the eye
loses its line on the return sweep. Tables, diagrams, demos and code are the exception, because
they are not read line by line: wrap them in `BlogFigure` (or mark any node `data-blog-wide`) and
they step out to `--blog-wide: 54rem`, centred on the column. The rail starts `7rem` past the
column so a wide figure never touches it. Do not put a `BlogFigure` inside a list or another
figure; the breakout is centred on the column.

Body leading is `leading-relaxed` (1.625). The old 1.5 was tuned for the 505px column; a longer
line wants more air.

## Spacing and type: tokens only

The blog uses the global spacing tokens ([spacing](./spacing.md)): `space-y-stack-*`,
`gap-inline-*`, `p-inset-*`. This work added `stack-4xl` (48px, page sections), `stack-5xl` (64px),
`inset-xl` (24px) and `inset-2xl` (32px). `blogArticlePage` and the new `blogIndex` tokens in
`lib/rabbit-holes/designTokens.ts` alias them. Titles are Commissioner light, the same as the
admin and sandbox galleries. Do not add a literal `px` or `space-y-8` to a post or a card.

## The index leads the eye

The index is composed like a page of print, not a feed:

1. **A warm glow** falls from the top-left behind the title: the first thing the eye meets, and it
   points down and to the right, toward where reading starts. It scrolls away, so it never sits
   behind text being read.
2. **The feature card** is the largest, warmest thing on the page: more padding, the biggest type
   and drawing, and a resting Lumen underlight. The eye lands there next.
3. **The two cards beside it** are the next step down, then **a quiet grid** for browsing.
4. **Prominence falls by material**, in reading order (size, light, type), and the entrance
   stagger (40ms) follows the same path.

Bento is used only where hierarchy exists: the top of the index. A long, equal-weight list stays a
plain grid. Bento is established but well worn, and it suits "one thing first" better than "many
equal things".

## Cards

`BlogCard` is the `glass()` primitive plus a Lumen spotlight that follows the pointer (two CSS
variables, no state, nothing on touch), the same recipe as the `/admin` cards. Keyboard focus is
`organic-focus`, never a ring. Hover is a 2px lift over 160ms, opacity and transform only;
`backdrop-filter` is static. None of it runs under reduced motion. Each card wears one abstract
line drawing (`BlogArt`): a mark of identity, never a chart, with Lumen picking out the one
element that is the post.

## Adding a post

1. Add it to `lib/blog/posts.ts` (the first entry is the feature; order is editorial).
2. Create `app/blog/<slug>/page.tsx` wrapping the content in `BlogArticleShell slug="<slug>"`.
3. Wrap figures in `BlogFigure`; use `BlogCode` or a fence for code (never a raw `<pre>`).
4. Use `<Term>` for glossary words and add the definition in `term-with-definition.tsx`.

`tests/unit/blog-posts.test.ts` fails if a registered post has no page.
