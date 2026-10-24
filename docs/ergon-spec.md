# Ergon — Product Spec (MVP)

> Status: **approved for build** · Scope: **todos only** (the project/board reimagining is explicitly future)
> Last updated: 2026-06-22

## 1. Concept & scope

Ergon is a **durable, planning-oriented todo list** — simpler than a kanban, deliberately
filling the gaps other todo apps leave. Two capture paths:

- **Quick-add** — type a title, hit Enter (normal todo behavior).
- **Aion via CoreInput** — natural language ("book the dentist next week, ~30 min, low effort")
  → Aion parses and fills the fields.

**In scope (this build):** todos — capture, organize, plan, complete; manual UI **and** Aion
add/manage; durable in Supabase; a single source of truth shared between the page and chat.

**Explicitly out of scope (future):** project/board power tools, dependencies, sub-task
hierarchies, the larger kanban reimagining. The existing kanban (`chatStyle: "ergon"`) is left
untouched and remains the heavyweight board tool for later.

## 2. Design principles (the bar)

1. **Cognitive-load balance — the vital one.** Progressive disclosure: a row surfaces only the
   few high-signal facets (title, category color, planned/due, a compact effort + duration glyph);
   everything else lives behind an expand. _Quiet by default, dense on demand._ Avoid badge-soup;
   never make the eye hunt. Equally, don't underwhelm — the planning view must show enough
   (capacity totals, what's today) to be decision-useful at a glance.
2. **Refined & calm aesthetic.** Reuse the existing design system (glass primitives, lumen cards).
   Generous whitespace; restrained palette where **category color is the primary accent**.
3. **Privacy & ownership as a feature.** We own the infra and know where data goes. Ergon is
   explicitly a place to dump _everything_ — the same low-friction trust one gives Apple Notes.
   This lowers the capture bar and is a deliberate product stance.
4. **Inherited intelligence (progressive).** Ergon gets smarter over time via memory + harness +
   (future) knowledge graph — see §3.

## 3. The gaps Ergon fills

| Gap in typical todo apps | How Ergon fills it | When |
|---|---|---|
| "Due" and "when I'll do it" are conflated | Separate `due_date` (deadline) **and** `planned_at` (do-date, optional time) | MVP |
| Flat lists ignore time & energy | `est_minutes` + `mental_effort` → plan by **capacity & energy** | MVP |
| No sense of overcommitment | Day groups show **summed time** (capacity) | MVP |
| Categories are dumb tags | Real, **colored/icon'd, user-managed** taxonomy | MVP |
| Tools are context-blind | Memory + harness let Aion understand _what_ a task means, _how it fits bigger pictures_, and write descriptions in **your** voice | Groundwork in MVP, grows later |
| Estimates are generic | Over time, estimate duration & mental effort **for you specifically**, from your history | Future (MVP captures the signal) |

**Inherited intelligence, MVP vs later.** The Aion tool runs server-side and `coreToolKit` already
exposes `memorySearch`, so the MVP can _optionally_ let Aion consult memory when creating a task
(light touch). Personalized estimate-learning and knowledge-graph linking are future; the MVP just
**captures the signal** (notably `completed_at`) so that future is possible without a re-migration.

## 4. Data model (Supabase) — extend, don't replace

Reuse the existing `tasks` table (`title`, `notes` = description, `due_date`, `priority`, `status`,
`tags`, `owner_id`, RLS via `current_profile_id()`). Changes are additive except the priority
type-change (no production data exists, so the cast is safe).

```sql
-- New: user-owned, extensible categories
create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default public.current_profile_id()
    references public.profiles(id) on delete cascade,
  name text not null,
  color text,                 -- hex or design token
  icon text,                  -- lucide icon name
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, lower(name))
);
-- + RLS owner-only policies mirroring the tasks table

-- priority: int (1-3) -> text enum, for a better UI; null = "no priority"
alter table public.tasks alter column priority drop not null;
alter table public.tasks alter column priority drop default;
alter table public.tasks alter column priority type text using (
  case priority when 1 then 'low' when 2 then 'medium' when 3 then 'high' else 'medium' end
);
alter table public.tasks add constraint tasks_priority_check
  check (priority is null or priority in ('low','medium','high','urgent'));

-- New columns (description reuses existing `notes`)
alter table public.tasks
  add column category_id      uuid references public.task_categories(id) on delete set null,
  add column planned_at       timestamptz,                  -- "date I plan to do it" (+ optional time)
  add column planned_has_time boolean not null default false, -- false => date-only; default time applied, UI hides time
  add column est_minutes      int,
  add column mental_effort    text,        -- 'low' | 'medium' | 'high'
  add column completed_at     timestamptz; -- Done-view ordering + future estimate-learning
alter table public.tasks add constraint tasks_mental_effort_check
  check (mental_effort is null or mental_effort in ('low','medium','high'));
```

Then `bun run supabase:types` to regenerate `lib/supabase/types.ts`.

**Date semantics.** `planned_at` is a full `timestamptz` with optional time: when the user enters
only month/day/year, store the date with a default time and set `planned_has_time = false` (the UI
shows a date only and can time-block later). `due_date` stays **day-granular** for the MVP —
deadlines are usually "by end of day X"; we can mirror the `planned_at` treatment for due dates
later via the same pattern if needed.

**Zod** (`lib/schemas/tasks.ts`): add
`TaskPriority = z.enum(["low","medium","high","urgent"])` (nullable),
`MentalEffort = z.enum(["low","medium","high"])`, `planned_at` (datetime), `planned_has_time`,
`est_minutes`, `mental_effort`, `category_id`, `completed_at`; add `CategoryCreate` / `CategoryUpdate`.

**Data layer**: extend `data/supabase/tasks.ts` (read/write new columns + category join); add
`data/supabase/task-categories.ts` (CRUD + resolve-or-create-by-name, which Aion needs).

## 5. UX — the `/ergon` page

**Route:** `app/ergon/page.tsx` (server component fetches tasks + categories) →
`components/ergon/ErgonPageClient.tsx`. Add an Ergon entry to the sidebar / nav.

- **Header:** quick-add bar (title → Enter) + "+" full editor + inline **CoreInput** to hand off
  to Aion.
- **View switcher** (segmented):
  - **Plan** _(default — the differentiator)_: grouped by `planned_at` → **Today / Tomorrow /
    This week / Later / Unscheduled**. Each group header shows count + summed est time (capacity).
  - **List:** all open tasks grouped by category (colored sections), sortable by priority / due.
  - **Done:** completed/archived, ordered by `completed_at`.
- **Filters:** category chips (colored, multi-select), priority, mental effort, status, search.
- **Task row** (progressive disclosure per §2.1): checkbox · title · category color · planned/due ·
  compact effort + duration glyph. Click → expand / side panel for description + full edit.
- **Empty state:** lumen-style starter cards.
- **Categories:** "+ New category" inline in the picker + a small manager (rename / recolor / icon).

**New components** (`components/ergon/`): `ErgonPageClient`, `views/PlanView` + `ListView`,
`TaskRow`, `TaskQuickAdd`, `TaskEditorPanel`, `TaskFilters`, `CategoryChip` + `CategoryPicker` +
`CategoryManager`; hooks `use-ergon-tasks.ts`, `use-task-categories.ts`.

## 6. Performance & caching

- **Categories → local cache (IN MVP).** Categories are small, reused in every picker, and rarely
  change — ideal to cache. Reuse the existing `createPersistentStore` (localStorage) pattern the
  kanban already uses (`lib/kanban/store.ts`). Strategy: **render from cache instantly, revalidate
  from the server in the background, reconcile.** No DB round-trip just to open an add/edit picker.
- **Tasks → optimistic mutations.** Add/edit/complete update the UI immediately and sync via server
  actions; re-fetch on focus / after mutation. (Realtime cross-surface sync is later.)
- **Aion secure task cache — NOTED, NOT in this build.** Caching hot tasks in a secure store so
  Aion-driven edits skip the full client → server → gateway → server → DB → … → client chain is a
  real future win, but explicitly excluded from this MVP. Captured here only so the data layer is
  designed without painting it into a corner.

## 7. Aion integration (durable, shared)

- **Tool** in `lib/llm/core/coreToolKit.ts`: `manage_tasks` with commands
  `CREATE_TASKS / UPDATE_TASK / COMPLETE_TASK / LIST_TASKS`. `execute()` runs **server-side via the
  data layer** (durable, not localStorage); category is passed **by name** → resolve-or-create.
  Returns `{ kind: "ergon-tasks", action, tasks }`. May optionally consult `memorySearch` (already
  in the toolkit) for context.
- **Navigation:** add `/ergon` to `pageMetadataObjects` / `NavigablePagesSchema`.
- **System prompt** (`lib/system-prompt/aion.ts`): parse natural language → fields, resolving
  relative dates against `{{currentDateTime}}`.
- **Compact card:** `components/ergon/ErgonTaskResult.tsx` (mirrors
  `components/chat/kanban/KanbanToolResult.tsx`) — affected tasks + a link to `/ergon`. Confirm at
  build time which surface renders Aion's CoreInput replies, so the card mounts there.

## 8. MVP scope & sequencing

- **Phase 0 — Foundation:** migration (`task_categories`, priority enum, new columns incl.
  `completed_at`), Zod, data-layer CRUD, regen types.
- **Phase 1 — Ergon page:** route + Plan/List/Done views, quick-add, full editor, filters,
  category chips + management, local category cache (§6), optimistic task mutations.
- **Phase 2 — Aion:** `manage_tasks` tool, `/ergon` nav, system prompt, compact card.

## 9. Explicitly deferred (not this build)

Project/board power-tool reimagining · Aion secure task-cache round-trip optimization (§6) ·
realtime cross-surface sync · personalized duration/effort estimate-learning · knowledge-graph task
linking · recurring tasks · calendar/due view · time-of-day on `due_date`.

## 10. Field reference

| Field | Type | Notes |
|---|---|---|
| `title` | text, required | min 2 chars |
| `notes` (description) | text, optional | reuses existing column |
| `due_date` | date, optional | day-granular deadline |
| `planned_at` | timestamptz, optional | do-date; optional time via `planned_has_time` |
| `planned_has_time` | boolean | false → date-only (default time applied, UI hides time) |
| `est_minutes` | int, optional | quick-picks 15 / 30 / 60 / 120 / 240 + custom |
| `mental_effort` | enum, optional | `low \| medium \| high` |
| `priority` | enum, nullable | `low \| medium \| high \| urgent`; null = none |
| `category_id` | uuid FK, optional | → `task_categories` |
| `tags` | text[] | existing column, retained |
| `status` | enum | `todo \| doing \| done \| archived`; checkbox toggles `todo ↔ done`, stamps `completed_at` |
| `completed_at` | timestamptz, nullable | set when completed |

---

### Revision history

- **2026-06-22** — Initial spec. Decisions locked: dedicated `task_categories` table; new durable
  `/ergon` page (kanban left untouched); chat archetype shares durable data; MVP = page + Aion
  add/manage with a compact card; `priority` as a text enum; `planned_at` as a full timestamp with
  optional time; local category cache pulled into MVP; Aion secure task-cache deferred.
