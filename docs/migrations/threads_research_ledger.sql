-- LEGACY: use research_ledgers.sql instead. Kept only as the historical pre-table schema.
-- Do not apply this script to new deployments.
-- Source snapshots, claims and owned crawl jobs stay in the researcher's own thread.
BEGIN;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS research_ledger text;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS research_ledger_rev text;
COMMENT ON COLUMN public.threads.research_ledger IS
  'Encrypted research evidence ledger, scoped to this thread and its owner.';
COMMENT ON COLUMN public.threads.research_ledger_rev IS
  'Optimistic lock for research_ledger: a new uuid on every save.';
COMMIT;
