-- Migration: Ergon Phase 0 — task_categories table + tasks schema extensions
-- Run in Supabase SQL editor or via your migration pipeline.
-- See docs/ergon-spec.md §4.

-- ---------------------------------------------------------------------------
-- task_categories: user-owned taxonomy for Ergon todos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_categories_owner_name_lower_idx
  ON public.task_categories (owner_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_task_categories_owner_id ON public.task_categories(owner_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_sort_order ON public.task_categories(owner_id, sort_order);

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own task categories"
  ON public.task_categories FOR SELECT
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can insert their own task categories"
  ON public.task_categories FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can update their own task categories"
  ON public.task_categories FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can delete their own task categories"
  ON public.task_categories FOR DELETE
  USING (owner_id = current_profile_id());

-- ---------------------------------------------------------------------------
-- tasks: priority int → text enum; new Ergon planning columns
-- ---------------------------------------------------------------------------

-- Drop integer-era CHECK constraints before changing column type (e.g. priority >= 1).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'tasks'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%priority%'
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.tasks ALTER COLUMN priority DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN priority DROP DEFAULT;

ALTER TABLE public.tasks ALTER COLUMN priority TYPE TEXT USING (
  CASE priority
    WHEN 1 THEN 'low'
    WHEN 2 THEN 'medium'
    WHEN 3 THEN 'high'
    ELSE 'medium'
  END
);

ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS planned_has_time BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS est_minutes INT,
  ADD COLUMN IF NOT EXISTS mental_effort TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_mental_effort_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_mental_effort_check
  CHECK (mental_effort IS NULL OR mental_effort IN ('low', 'medium', 'high'));

CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON public.tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_planned_at ON public.tasks(planned_at);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at);

COMMENT ON TABLE public.task_categories IS 'User-owned categories for Ergon durable todos.';
COMMENT ON COLUMN public.tasks.planned_at IS 'Do-date; optional time via planned_has_time.';
COMMENT ON COLUMN public.tasks.planned_has_time IS 'False => date-only (default time applied, UI hides time).';
COMMENT ON COLUMN public.tasks.completed_at IS 'Set when status becomes done; used for Done view ordering.';
