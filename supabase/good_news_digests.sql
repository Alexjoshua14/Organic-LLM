-- Daily Good News Digest storage.
--
-- This repo manages schema in the Supabase dashboard (no migrations folder), so
-- run this once in the Supabase SQL editor, then refresh generated types with:
--   bun run supabase:types
--
-- Reads happen exclusively server-side via the service-role client
-- (lib/supabase/supabase-admin.ts), so RLS is enabled with no public policy:
-- the service role bypasses RLS and anon/auth clients get no access.

create table if not exists public.good_news_digests (
  digest_date   date primary key,
  items         jsonb       not null default '[]'::jsonb,
  status        text        not null default 'ready',
  model         text,
  meta          jsonb       not null default '{}'::jsonb,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists good_news_digests_generated_at_idx
  on public.good_news_digests (generated_at desc);

alter table public.good_news_digests enable row level security;

-- No policies: only the service role (which bypasses RLS) may read/write.
