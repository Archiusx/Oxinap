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

-- ============================================================
-- ACCESS CONTROL — "only authorised users can view/modify case
-- profiles" (core feature #1). Case owners can grant viewer/editor
-- access to other investigators by email; investigations RLS is
-- extended to honour those grants.
-- ============================================================

create table if not exists public.case_access (
  id            bigint generated always as identity primary key,
  case_id       text not null,
  owner_id      text not null,                 -- Firebase UID of the case owner
  grantee_email text not null,
  role          text not null default 'viewer' check (role in ('viewer','editor')),
  status        text not null default 'pending' check (status in ('pending','accepted')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  unique (case_id, grantee_email)
);

-- If the table already existed from an earlier version, add the new columns.
alter table public.case_access add column if not exists status text not null default 'pending';
alter table public.case_access add column if not exists accepted_at timestamptz;
alter table public.case_access drop constraint if exists case_access_status_check;
alter table public.case_access add constraint case_access_status_check check (status in ('pending','accepted'));

create index if not exists case_access_grantee_idx on public.case_access (lower(grantee_email));
create index if not exists case_access_case_id_idx on public.case_access (case_id);

alter table public.case_access enable row level security;

-- Owners create/view/remove grants on their own cases. Owners can also see
-- and change role on a pending/accepted grant, but NOT flip status to
-- 'accepted' themselves — that only an "accept" by the grantee may do
-- (enforced by the separate grantee policy below + app-level field control).
drop policy if exists "owner manages access grants" on public.case_access;
create policy "owner manages access grants"
  on public.case_access for all
  using ((select auth.jwt()->>'sub') = owner_id)
  with check ((select auth.jwt()->>'sub') = owner_id);

-- Grantees can see the grants addressed to them (pending + accepted) —
-- drives "Pending Invites" and "Shared with me".
drop policy if exists "grantee can view own grants" on public.case_access;
create policy "grantee can view own grants"
  on public.case_access for select
  using (lower((select auth.jwt()->>'email')) = lower(grantee_email));

-- Grantees may ONLY flip their own invite from pending -> accepted. They
-- cannot change case_id, owner_id, role, or grantee_email on the row.
drop policy if exists "grantee can accept own invite" on public.case_access;
create policy "grantee can accept own invite"
  on public.case_access for update
  using (lower((select auth.jwt()->>'email')) = lower(grantee_email))
  with check (lower((select auth.jwt()->>'email')) = lower(grantee_email));

-- Grantees may decline/leave by deleting their own grant row.
drop policy if exists "grantee can decline or leave" on public.case_access;
create policy "grantee can decline or leave"
  on public.case_access for delete
  using (lower((select auth.jwt()->>'email')) = lower(grantee_email));

-- Replace the investigations SELECT policy: owner OR an ACCEPTED grantee.
-- A merely-invited (pending) grantee gets NOTHING until they accept.
drop policy if exists "select own investigations" on public.investigations;
drop policy if exists "select own or shared investigations" on public.investigations;
create policy "select own or shared investigations"
  on public.investigations for select
  using (
    (select auth.jwt()->>'sub') = user_id
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = investigations.case_id
        and lower(ca.grantee_email) = lower((select auth.jwt()->>'email'))
        and ca.status = 'accepted'
    )
  );

-- Replace the investigations UPDATE policy: owner OR an ACCEPTED grantee
-- with the "editor" role (pending grantees and viewers stay locked out of writes).
drop policy if exists "update own investigations" on public.investigations;
drop policy if exists "update own or shared-editor investigations" on public.investigations;
create policy "update own or shared-editor investigations"
  on public.investigations for update
  using (
    (select auth.jwt()->>'sub') = user_id
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = investigations.case_id
        and lower(ca.grantee_email) = lower((select auth.jwt()->>'email'))
        and ca.role = 'editor'
        and ca.status = 'accepted'
    )
  )
  with check (
    (select auth.jwt()->>'sub') = user_id
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = investigations.case_id
        and lower(ca.grantee_email) = lower((select auth.jwt()->>'email'))
        and ca.role = 'editor'
        and ca.status = 'accepted'
    )
  );

-- INSERT/DELETE on investigations stay owner-only (unchanged policies above).

-- ── Defense in depth: the UPDATE policy above lets a grantee flip their own
-- row's status, but RLS "with check" alone can't stop them from ALSO
-- changing role/case_id/owner_id/grantee_email in that same request (e.g. by
-- calling the Supabase REST API directly instead of using the app UI). This
-- trigger enforces that a grantee-initiated update may ONLY move
-- status: pending -> accepted, and touch nothing else.
create or replace function public.protect_case_access_grantee_update()
returns trigger as $$
begin
  if lower((select auth.jwt()->>'email')) = lower(old.grantee_email)
     and (select auth.jwt()->>'sub') is distinct from old.owner_id then
    if new.case_id is distinct from old.case_id
       or new.owner_id is distinct from old.owner_id
       or new.role is distinct from old.role
       or lower(new.grantee_email) is distinct from lower(old.grantee_email) then
      raise exception 'Grantees may only accept their invite, not modify it.';
    end if;
    if old.status = 'accepted' and new.status is distinct from 'accepted' then
      raise exception 'Cannot revert an accepted invite.';
    end if;
    if new.status not in ('pending','accepted') then
      raise exception 'Invalid status.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists case_access_protect_grantee_update on public.case_access;
create trigger case_access_protect_grantee_update
  before update on public.case_access
  for each row execute function public.protect_case_access_grantee_update();

alter publication supabase_realtime add table public.case_access;
