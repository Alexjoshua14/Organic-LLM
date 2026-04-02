-- Pinned message context + process-only send mode

-- 1) Thread persona key (server-owned, can be null for legacy/default chats)
alter table if exists public.threads
  add column if not exists persona text;

-- 2) Persist send behavior metadata for user-originated messages
alter table if exists public.messages
  add column if not exists send_mode text;

alter table if exists public.messages
  drop constraint if exists messages_send_mode_check;

alter table if exists public.messages
  add constraint messages_send_mode_check
  check (send_mode is null or send_mode in ('respond', 'process_only'));

-- 3) Pin target enum
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pin_target_type'
      and n.nspname = 'public'
  ) then
    create type public.pin_target_type as enum ('thread', 'persona');
  end if;
end
$$;

-- 4) Links that bind a message to thread/persona context targets
create table if not exists public.message_context_links (
  id uuid primary key default gen_random_uuid(),
  message_id text not null references public.messages(id) on delete restrict,
  target_type public.pin_target_type not null,
  target_id text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (message_id, target_type, target_id)
);

create index if not exists message_context_links_target_idx
  on public.message_context_links (target_type, target_id);

create index if not exists message_context_links_message_idx
  on public.message_context_links (message_id);

-- 5) RLS for owner-only visibility/mutations
alter table public.message_context_links enable row level security;

drop policy if exists "message_context_links_select_owner" on public.message_context_links;
create policy "message_context_links_select_owner"
  on public.message_context_links
  for select
  using (
    exists (
      select 1
      from public.messages m
      join public.threads t on t.id = m.thread_id
      where m.id = message_context_links.message_id
        and t.owner_id = public.current_profile_id()
    )
  );

drop policy if exists "message_context_links_insert_owner" on public.message_context_links;
create policy "message_context_links_insert_owner"
  on public.message_context_links
  for insert
  with check (
    created_by = public.current_profile_id()
    and exists (
      select 1
      from public.messages m
      join public.threads t on t.id = m.thread_id
      where m.id = message_context_links.message_id
        and t.owner_id = public.current_profile_id()
    )
  );

drop policy if exists "message_context_links_delete_owner" on public.message_context_links;
create policy "message_context_links_delete_owner"
  on public.message_context_links
  for delete
  using (
    exists (
      select 1
      from public.messages m
      join public.threads t on t.id = m.thread_id
      where m.id = message_context_links.message_id
        and t.owner_id = public.current_profile_id()
    )
  );

-- 6) Force-delete helper to remove links + message atomically
create or replace function public.delete_message_with_links(
  p_message_id text,
  p_force boolean default false
)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_is_pinned boolean;
begin
  select exists (
    select 1 from public.message_context_links where message_id = p_message_id
  )
  into v_is_pinned;

  if v_is_pinned and not p_force then
    raise exception 'message_pinned';
  end if;

  if p_force then
    delete from public.message_context_links where message_id = p_message_id;
  end if;

  delete from public.messages where id = p_message_id;
  return found;
end;
$$;
