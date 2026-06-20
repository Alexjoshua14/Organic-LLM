-- Spatial artifacts: hybrid pointer + GenUIBlock snapshot cache.
-- Apply in Supabase SQL Editor before using the spatial-archetypes prototype.

create table if not exists public.spatial_artifacts (
  id text primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null,
  message_id text not null,
  tool_call_id text not null default '',
  block_type text not null,
  thread_title text not null default '',
  block_snapshot jsonb,
  snapshot_updated_at timestamptz,
  source_message_updated_at timestamptz,
  pinned boolean not null default false,
  pinned_at timestamptz,
  sync_lock_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists spatial_artifacts_owner_id_idx on public.spatial_artifacts (owner_id);
create index if not exists spatial_artifacts_thread_id_idx on public.spatial_artifacts (thread_id);
create index if not exists spatial_artifacts_pinned_idx on public.spatial_artifacts (owner_id, pinned desc, created_at desc);

alter table public.spatial_artifacts enable row level security;

create policy "spatial_artifacts_select_own"
  on public.spatial_artifacts for select
  using (owner_id = public.current_profile_id());

create policy "spatial_artifacts_insert_own"
  on public.spatial_artifacts for insert
  with check (owner_id = public.current_profile_id());

create policy "spatial_artifacts_update_own"
  on public.spatial_artifacts for update
  using (owner_id = public.current_profile_id());

create policy "spatial_artifacts_delete_own"
  on public.spatial_artifacts for delete
  using (owner_id = public.current_profile_id());
