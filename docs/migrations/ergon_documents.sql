-- Migration: Ergon linked documents for kanban chat style
-- Run in Supabase SQL editor or via your migration pipeline.

create table if not exists public.ergon_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null,
  kanban_item_id text not null,
  title text not null,
  content text not null,
  format text not null default 'markdown',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ergon_documents_owner_thread_idx
  on public.ergon_documents (owner_id, thread_id);

create index if not exists ergon_documents_thread_item_idx
  on public.ergon_documents (thread_id, kanban_item_id);

alter table public.ergon_documents enable row level security;

create policy "ergon_documents_select_own"
  on public.ergon_documents for select
  using (owner_id = public.current_profile_id());

create policy "ergon_documents_insert_own"
  on public.ergon_documents for insert
  with check (owner_id = public.current_profile_id());

create policy "ergon_documents_update_own"
  on public.ergon_documents for update
  using (owner_id = public.current_profile_id());

create policy "ergon_documents_delete_own"
  on public.ergon_documents for delete
  using (owner_id = public.current_profile_id());
