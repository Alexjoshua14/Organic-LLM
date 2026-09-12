# Remy — meal prep

Remy is Organic LLM’s cooking persona. `/remy` is a **desktop dashboard** whose default
view is this week’s meal plan (Library and Shopping are modes). Full-page threads stay
at `/remy/[id]`; the dashboard Chat button opens the Remy dock.

This doc is the **public, operational** half: what it is, which files own what, and the
intended code map. Product intent — scope, acceptance criteria, roadmap — is private and
lives in `organic-llm-hub/remy/`.

| Doc | Holds |
|-----|-------|
| This README | What Remy is, code paths, mise vs prep, one recipe-card |
| [`decisions/`](./decisions/) | ADRs (write-through `prep_plan`, …) |
| `organic-llm-hub/remy/product-spec.md` | Product intent (private repo) |
| `organic-llm-hub/remy/open-questions.md` | Unresolved product direction (private) |

For UI and motion work, read the [design backbone](../design/README.md) first, especially
[spacing](../design/spacing.md). Layout analog for the dashboard shell:
[`app/ergon/page.tsx`](../../app/ergon/page.tsx).

## Mise is events / prep is weeks

Two systems. Do not stretch one into the other.

| Job | Tool / tables | When |
|-----|---------------|------|
| **Events** (gatherings, a one-off menu) | `mise_plan` → `mise_events` / `mise_recipes` | Hosting, party, a dated event plan |
| **Weeks** (reusable library + Mon–Sun slots) | `prep_plan` → `prep_recipes` / `prep_weeks` / `prep_placements` / `prep_week_ingredients` | This week’s breakfast / lunch / dinner |

Event mise stays as-is. Recipes in the prep library are first-class and reusable. Event
recipes are **not** auto-imported into that library.

## One recipe card, extended

There is a single card type. Do not add a `PrepRecipeCard` or a parallel Zod card.

Today:

| Piece | Path |
|-------|------|
| Shared body | [`lib/schemas/gen-ui/recipe-card.ts`](../../lib/schemas/gen-ui/recipe-card.ts) — `RecipeCardBodySchema` (core fields plus optional `complexity`, `duration`, `mainProtein`, `mainCarbs`, `cuisine`, `equipment`) |
| Block schema | `RecipeCardBlockSchema` = `{ type, version }` + body |
| Renderer | [`components/chat/gen-ui/blocks/RecipeCard.tsx`](../../components/chat/gen-ui/blocks/RecipeCard.tsx) |
| Mise | [`lib/schemas/mise/recipe.ts`](../../lib/schemas/mise/recipe.ts) — `{ id }` + the same body; [`lib/mise/select-view.ts`](../../lib/mise/select-view.ts) (`recipeToBlock`) |
| Prep library | [`lib/schemas/prep/recipe.ts`](../../lib/schemas/prep/recipe.ts) — `{ id, clientKey }` + the same body |

`GEN_UI_VERSION` stays 1. Cards without the glance fields still parse and render.

**Week glance cell:** [`components/remy/RemyGlanceCell.tsx`](../../components/remy/RemyGlanceCell.tsx) is a compact read of those fields (title, complexity, duration, main protein, main carbs) — not a second card type. Opening a slot or library item mounts `RecipeCard`. Leftover slots show a leftover badge and those glance fields; they do not add ingredients.

## Exists today

```
app/remy/page.tsx                 — dashboard shell (Week | Library | Shopping)
components/remy/RemyPageClient.tsx — mounts RemyChatDock (Ask Remy passes date/slot/title)
components/remy/RemyChatDock.tsx  — right-side Chat dock (`persona="remy"`)
app/remy/[slug]/page.tsx          — full-page Remy thread (`persona="remy"`)
app/remy/tmp/page.tsx             — temporary chat
app/api/ai/remy/route.ts          — Remy API (`mise_plan`, `prep_plan`, `fetch_recipe`)
lib/llm/prep-plan-tool.ts         — weekly write-through tool
lib/llm/prep-plan-execute.ts      — applies prep_plan against prep_* tables
lib/schemas/prep/ + lib/prep/     — week / placement / leftover-aware shopping
data/supabase/prep.ts             — prep_* persistence
lib/remy/thread-matching.ts
lib/remy/planner-thread.ts        — dedicated dock thread (`feature = remy_planner`)
docs/migrations/prep_tables.sql
docs/migrations/mise_recipes_glance_fields.sql
```

| Area | Path |
|------|------|
| Dashboard | `app/remy/page.tsx` + `components/remy/` (`RemyPageClient` mounts `RemyChatDock`) |
| Thread | `app/remy/[slug]/page.tsx` |
| Remy API | `app/api/ai/remy/route.ts` (`mise_plan`, `prep_plan`, `fetch_recipe`) |
| Event mise tool | `lib/llm/mise-tool.ts` |
| Weekly prep tool | `lib/llm/prep-plan-tool.ts` (Ergon-style write-through; not a thread puppet) |
| Planner dock | `components/remy/RemyChatDock.tsx` — first open resumes `remy_planner` thread; slot Ask Remy prefills date/slot/title |
| Prep domain | `lib/schemas/prep/`, `lib/prep/`, `data/supabase/prep.ts` |
| Mise data | `data/supabase/mise.ts` |
| Migrations | `docs/migrations/prep_tables.sql`, `docs/migrations/mise_recipes_glance_fields.sql`, `docs/migrations/mise_tables.sql` |

`lib/supabase/types.ts` does not yet include `prep_*` (or `mise_*`). After applying
those migrations, run `bun run supabase:types` to regenerate it. Until then,
`data/supabase/prep.ts` maps rows through Zod the same way `mise.ts` does.

## Intended (not all exist yet)

Dashboard shell, library, shopping, leftovers, and dock are in place. Still open:
mobile layout, pantry inventory, drag-and-drop, multi-recipe slots. Event mise
recipes are **not** auto-imported into the prep library.

Shopping **recomputes from cook placements** (ignore leftover-of rows). The week is not
owned by a chat thread — tools persist, the page reads the same tables.

## Working on Remy

1. Read this file, then product intent in `organic-llm-hub/remy/` (sibling clone).
2. Mise vs prep: events stay on `mise_*`; weeks go on `prep_*`.
3. Extend the existing recipe-card; do not fork it.
4. Design tokens: [`docs/design/README.md`](../design/README.md).
