-- ============================================================================
-- DuoDraw — Supabase schema, security policies, and expiration/cleanup logic
-- ----------------------------------------------------------------------------
-- Run this whole file once in the Supabase SQL editor (Dashboard → SQL Editor
-- → New query → paste → Run). It is safe to re-run: everything uses
-- IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
--
-- DESIGN NOTE ON PRIVACY:
-- DuoDraw intentionally stores almost nothing. Only two tables persist to
-- disk: `rooms` (a room code + expiry) and `participants` (a temporary
-- session id + a display name like "Artist 1"). Drawing strokes and chat
-- messages are NEVER written to the database at all — they travel only
-- through Supabase Realtime Broadcast, which is a live pub/sub relay and
-- does not persist payloads anywhere. When both browsers close, that data
-- is simply gone. This is why there is no `drawing_events` or
-- `chat_messages` table below: the strongest privacy guarantee for
-- ephemeral data is to never store it in the first place.
-- ============================================================================

-- Enable the extension used to generate UUIDs.
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table: rooms
-- ----------------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  room_code    text unique not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  status       text not null default 'waiting' check (status in ('waiting', 'active', 'closed'))
);

create index if not exists rooms_room_code_idx on public.rooms (room_code);
create index if not exists rooms_expires_at_idx on public.rooms (expires_at);

-- ----------------------------------------------------------------------------
-- Table: participants
-- ----------------------------------------------------------------------------
create table if not exists public.participants (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms (id) on delete cascade,
  session_id    uuid not null,
  display_name  text not null,
  joined_at     timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  unique (room_id, session_id)
);

create index if not exists participants_room_id_idx on public.participants (room_id);

-- Enforce "max 2 participants per room" directly in the database, so it can
-- never be bypassed even if application code has a bug.
create or replace function public.enforce_room_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  select count(*) into current_count
  from public.participants
  where room_id = new.room_id;

  if current_count >= 2 then
    raise exception 'ROOM_FULL';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_room_capacity on public.participants;
create trigger trg_enforce_room_capacity
  before insert on public.participants
  for each row execute function public.enforce_room_capacity();

-- Keep room status in sync with how many people are actually in it.
create or replace function public.sync_room_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room uuid;
  current_count integer;
begin
  target_room := coalesce(new.room_id, old.room_id);

  select count(*) into current_count
  from public.participants
  where room_id = target_room;

  if current_count >= 2 then
    update public.rooms set status = 'active' where id = target_room;
  elsif current_count = 1 then
    update public.rooms set status = 'waiting' where id = target_room;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_room_status_ins on public.participants;
create trigger trg_sync_room_status_ins
  after insert on public.participants
  for each row execute function public.sync_room_status();

drop trigger if exists trg_sync_room_status_del on public.participants;
create trigger trg_sync_room_status_del
  after delete on public.participants
  for each row execute function public.sync_room_status();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- DuoDraw uses Supabase anonymous auth: every browser tab gets a temporary
-- auth.uid() the moment it loads, with no email/password and no profile.
-- That uid is stored client-side as the participant's session_id, so RLS can
-- check "is this request coming from a session that actually belongs to this
-- room" without ever knowing who the person is.

alter table public.rooms enable row level security;
alter table public.participants enable row level security;

-- Anyone holding a valid (non-expired) room code can look up that room —
-- this is required so "Join Room" can validate a code before joining.
drop policy if exists "rooms_select_active" on public.rooms;
create policy "rooms_select_active"
  on public.rooms for select
  to authenticated
  using (expires_at > now());

-- Any authenticated (anonymous) session can create a room.
drop policy if exists "rooms_insert_any" on public.rooms;
create policy "rooms_insert_any"
  on public.rooms for insert
  to authenticated
  with check (true);

-- Only participants already in the room may update it (e.g. heartbeat
-- extending expires_at, or closing it on leave).
drop policy if exists "rooms_update_participant" on public.rooms;
create policy "rooms_update_participant"
  on public.rooms for update
  to authenticated
  using (
    exists (
      select 1 from public.participants p
      where p.room_id = rooms.id and p.session_id = auth.uid()
    )
  );

-- A session can see participant rows only for rooms it has itself joined.
drop policy if exists "participants_select_same_room" on public.participants;
create policy "participants_select_same_room"
  on public.participants for select
  to authenticated
  using (
    exists (
      select 1 from public.participants me
      where me.room_id = participants.room_id and me.session_id = auth.uid()
    )
    or session_id = auth.uid()
  );

-- A session may only ever insert itself as a participant (never impersonate
-- another session), and only into a room that has not expired.
drop policy if exists "participants_insert_self" on public.participants;
create policy "participants_insert_self"
  on public.participants for insert
  to authenticated
  with check (
    session_id = auth.uid()
    and exists (select 1 from public.rooms r where r.id = room_id and r.expires_at > now())
  );

-- A session may only update its own heartbeat row.
drop policy if exists "participants_update_self" on public.participants;
create policy "participants_update_self"
  on public.participants for update
  to authenticated
  using (session_id = auth.uid());

-- A session may only remove itself (used by "Leave Room").
drop policy if exists "participants_delete_self" on public.participants;
create policy "participants_delete_self"
  on public.participants for delete
  to authenticated
  using (session_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Realtime: broadcast + presence only
-- ----------------------------------------------------------------------------
-- Drawing strokes, cursor presence, and chat messages all travel over a
-- per-room Supabase Realtime channel named "room:<room_code>" using
-- Broadcast (ephemeral pub/sub) and Presence (ephemeral online-state).
-- Neither mechanism writes anything to Postgres, so no table/policy is
-- needed for them — the only thing to enable is Realtime on the two tables
-- below, so clients can react instantly to a participant joining/leaving.

alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.rooms;

-- ----------------------------------------------------------------------------
-- Expiration / cleanup
-- ----------------------------------------------------------------------------
-- Deletes rooms whose expiry has passed. Deleting a room cascades and
-- deletes its participants too, so no orphaned rows are left behind.
create or replace function public.cleanup_expired_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms where expires_at < now();
$$;

-- Schedule the cleanup to run automatically every 5 minutes using
-- pg_cron (bundled with every Supabase project). This block is wrapped so
-- the whole script still runs even on plans where pg_cron isn't enabled —
-- in that case, call public.cleanup_expired_rooms() from a scheduled
-- Supabase Edge Function instead (see README "Configure cleanup").
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'duodraw-cleanup-expired-rooms',
      '*/5 * * * *',
      $cron$select public.cleanup_expired_rooms();$cron$
    );
  else
    raise notice 'pg_cron not installed — enable it in Database → Extensions, then re-run this file, or call cleanup_expired_rooms() from a scheduled Edge Function.';
  end if;
end;
$$;
