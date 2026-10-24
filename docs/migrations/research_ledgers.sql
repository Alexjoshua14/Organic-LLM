-- Apply explicitly via the SQL editor or migration pipeline; not auto-applied.
-- Replaces threads_research_ledger.sql for new deployments. Existing ciphertext is preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS public.research_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload text,
  payload_rev text,
  -- Backfilled rows use the old thread/field AAD; cleared on the first successful save.
  legacy_thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_ledgers_id_owner_key UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS research_ledgers_owner_updated_idx ON public.research_ledgers (owner_id, updated_at DESC);
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS research_ledger_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'threads_research_ledger_owner_fkey' AND conrelid = 'public.threads'::regclass) THEN
    ALTER TABLE public.threads ADD CONSTRAINT threads_research_ledger_owner_fkey
      FOREIGN KEY (research_ledger_id, owner_id) REFERENCES public.research_ledgers (id, owner_id)
      ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS threads_research_ledger_idx ON public.threads (research_ledger_id) WHERE research_ledger_id IS NOT NULL;

-- Transactional backfill retains evidence without requiring secrets in SQL.
-- Legacy columns remain as a rollback copy when present; the app never reads/writes them.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'threads' AND column_name = 'research_ledger')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'threads' AND column_name = 'research_ledger_rev') THEN
    EXECUTE 'INSERT INTO public.research_ledgers (id, owner_id, payload, payload_rev, legacy_thread_id)
      SELECT id, owner_id, research_ledger, research_ledger_rev, id FROM public.threads
      WHERE research_ledger IS NOT NULL AND research_ledger_id IS NULL ON CONFLICT (id) DO NOTHING';
    EXECUTE 'UPDATE public.threads t SET research_ledger_id = l.id FROM public.research_ledgers l
      WHERE t.research_ledger_id IS NULL AND t.research_ledger IS NOT NULL
      AND l.id = t.id AND l.owner_id = t.owner_id AND l.legacy_thread_id = t.id';
  END IF;
END $$;

ALTER TABLE public.research_ledgers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS research_ledgers_owner_access ON public.research_ledgers;
CREATE POLICY research_ledgers_owner_access ON public.research_ledgers FOR ALL
  USING (owner_id = current_profile_id()) WITH CHECK (owner_id = current_profile_id());

CREATE OR REPLACE FUNCTION public.update_research_ledger_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_research_ledger_updated_at ON public.research_ledgers;
CREATE TRIGGER update_research_ledger_updated_at BEFORE UPDATE ON public.research_ledgers
  FOR EACH ROW EXECUTE FUNCTION public.update_research_ledger_updated_at();

COMMENT ON TABLE public.research_ledgers IS 'Owner-scoped encrypted research evidence, claims, crawl jobs and approved reuse entries.';
COMMENT ON COLUMN public.threads.research_ledger_id IS 'Reference to an independently stored research ledger belonging to this thread owner.';
COMMENT ON COLUMN public.research_ledgers.payload_rev IS 'Optimistic lock: a new uuid on every payload save.';
COMMIT;
