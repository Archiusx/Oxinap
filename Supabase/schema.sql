-- ============================================================
-- CyIntel — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

create table if not exists public.investigations (
  id          bigint generated always as identity primary key,
  case_id     text not null,
  user_id     text not null,              -- Firebase UID (auth.jwt()->>'sub')
  target      text not null,
  type        text not null default 'keyword',
  status      text not null default 'Completed',
  risk        text not null default 'unknown',
  platforms   jsonb not null default '[]',
  data        jsonb not null default '{}', -- full investigation object
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, case_id)
);

create index if not exists investigations_user_id_created_at_idx
  on public.investigations (user_id, created_at desc);

-- Row Level Security: a user can only ever see / write their own rows.
alter table public.investigations enable row level security;

drop policy if exists "select own investigations" on public.investigations;
create policy "select own investigations"
  on public.investigations for select
  using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "insert own investigations" on public.investigations;
create policy "insert own investigations"
  on public.investigations for insert
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "update own investigations" on public.investigations;
create policy "update own investigations"
  on public.investigations for update
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "delete own investigations" on public.investigations;
create policy "delete own investigations"
  on public.investigations for delete
  using ((select auth.jwt()->>'sub') = user_id);

-- Enable Realtime so the dashboard's live subscription gets push updates.
alter publication supabase_realtime add table public.investigations;
