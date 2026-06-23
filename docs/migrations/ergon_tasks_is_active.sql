-- Ergon: mark tasks as active (focus / in-progress highlight)
-- Run after ergon_tasks_and_categories.sql

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON public.tasks(owner_id, is_active)
  WHERE is_active = TRUE;

COMMENT ON COLUMN public.tasks.is_active IS 'User-marked active/focus task; Ergon UI shows lumen highlight when true.';
