-- Tech Token Heist - hardened Supabase event schema and access setup.
-- Run this in the Supabase SQL Editor for the project used by the frontend.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

grant usage on schema public to anon, authenticated;
grant usage on schema extensions to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

create table if not exists public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  member_names text[] not null default array[]::text[],
  leader text,
  password text not null,
  tokens integer not null default 1,
  status text not null default 'idle',
  total_time bigint not null default 0,
  timeout_until bigint,
  last_token_update_time bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.matchmaking_queue (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_name text not null,
  team_tokens integer not null default 0,
  matched_with uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id)
);

create table if not exists public.active_matches (
  id uuid primary key default extensions.gen_random_uuid(),
  team_a uuid not null references public.teams(id) on delete restrict,
  team_b uuid not null references public.teams(id) on delete restrict,
  domain text not null,
  start_time bigint not null,
  is_wager boolean not null default false,
  "teamA" jsonb,
  "teamB" jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.match_history (
  id uuid primary key default extensions.gen_random_uuid(),
  winner text,
  loser text,
  winner_id uuid,
  loser_id uuid,
  domain text,
  "timestamp" text,
  is_wager boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  message text not null,
  "time" text,
  created_at timestamptz not null default now()
);

create table if not exists public.token_history (
  id uuid primary key default extensions.gen_random_uuid(),
  team text,
  change text,
  reason text,
  "timestamp" text,
  created_at timestamptz not null default now()
);

create table if not exists public.system (
  key text primary key,
  status text,
  is_game_active boolean not null default false,
  is_paused boolean not null default false,
  phase text not null default 'phase1',
  game_started_at bigint,
  paused_at bigint,
  timeout_duration_override bigint,
  domains text[] not null default array['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'],
  finale_state jsonb
);

create table if not exists private.admin_sessions (
  session_token text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.teams add column if not exists member_names text[] not null default array[]::text[];
alter table public.teams add column if not exists leader text;
alter table public.teams add column if not exists password text;
alter table public.teams add column if not exists tokens integer not null default 1;
alter table public.teams add column if not exists status text not null default 'idle';
alter table public.teams add column if not exists total_time bigint not null default 0;
alter table public.teams add column if not exists timeout_until bigint;
alter table public.teams add column if not exists last_token_update_time bigint;
alter table public.teams add column if not exists created_at timestamptz not null default now();

alter table public.matchmaking_queue add column if not exists team_id uuid;
alter table public.matchmaking_queue add column if not exists team_name text;
alter table public.matchmaking_queue add column if not exists team_tokens integer not null default 0;
alter table public.matchmaking_queue add column if not exists matched_with uuid;
alter table public.matchmaking_queue add column if not exists created_at timestamptz not null default now();

alter table public.active_matches add column if not exists team_a uuid;
alter table public.active_matches add column if not exists team_b uuid;
alter table public.active_matches add column if not exists domain text;
alter table public.active_matches add column if not exists start_time bigint;
alter table public.active_matches add column if not exists is_wager boolean not null default false;
alter table public.active_matches add column if not exists "teamA" jsonb;
alter table public.active_matches add column if not exists "teamB" jsonb;
alter table public.active_matches add column if not exists created_at timestamptz not null default now();

alter table public.match_history add column if not exists winner text;
alter table public.match_history add column if not exists loser text;
alter table public.match_history add column if not exists winner_id uuid;
alter table public.match_history add column if not exists loser_id uuid;
alter table public.match_history add column if not exists domain text;
alter table public.match_history add column if not exists "timestamp" text;
alter table public.match_history add column if not exists is_wager boolean not null default false;
alter table public.match_history add column if not exists created_at timestamptz not null default now();

alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists "time" text;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

alter table public.token_history add column if not exists team text;
alter table public.token_history add column if not exists change text;
alter table public.token_history add column if not exists reason text;
alter table public.token_history add column if not exists "timestamp" text;
alter table public.token_history add column if not exists created_at timestamptz not null default now();

alter table public.system add column if not exists status text;
alter table public.system add column if not exists is_game_active boolean not null default false;
alter table public.system add column if not exists is_paused boolean not null default false;
alter table public.system add column if not exists phase text not null default 'phase1';
alter table public.system add column if not exists game_started_at bigint;
alter table public.system add column if not exists paused_at bigint;
alter table public.system add column if not exists timeout_duration_override bigint;
alter table public.system add column if not exists domains text[] not null default array['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
alter table public.system add column if not exists finale_state jsonb;

insert into public.system (key, status, is_game_active, is_paused, phase)
values ('game', 'not_started', false, false, 'phase1')
on conflict (key) do nothing;

insert into public.system (key, status)
values ('admin_credential', null)
on conflict (key) do nothing;

do $$
declare
  default_domains text[] := array['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
  domains_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into domains_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'system'
    and attribute.attname = 'domains'
    and not attribute.attisdropped;

  if domains_type = 'jsonb' then
    execute $sql$
      update public.system
      set domains = $1::jsonb
      where key = 'game' and domains is null
    $sql$ using to_jsonb(default_domains);
  else
    execute $sql$
      update public.system
      set domains = $1::text[]
      where key = 'game' and domains is null
    $sql$ using default_domains;
  end if;
end $$;

drop trigger if exists active_matches_sync_team_status on public.active_matches;
drop trigger if exists active_matches_clear_queue_rows on public.active_matches;
drop trigger if exists active_matches_strip_team_snapshots on public.active_matches;
drop trigger if exists active_matches_prevent_duplicate on public.active_matches;
drop trigger if exists matchmaking_queue_no_self_match on public.matchmaking_queue;
drop trigger if exists teams_guard_active_runtime_edit on public.teams;

drop function if exists public.active_matches_sync_team_status() cascade;
drop function if exists public.active_matches_clear_queue_rows() cascade;
drop function if exists public.active_matches_strip_team_snapshots() cascade;
drop function if exists public.active_matches_prevent_duplicate() cascade;
drop function if exists public.matchmaking_queue_no_self_match() cascade;
drop function if exists public.guard_active_team_runtime_edit() cascade;
drop function if exists public.declare_match_winner(uuid, uuid, text) cascade;
drop function if exists public.login_team(text, text) cascade;
drop function if exists public.login_admin(text, text) cascade;
drop function if exists public.login_admin_session(text, text) cascade;
drop function if exists public.valid_admin_session() cascade;
drop function if exists public.admin_credential_configured() cascade;

create or replace function public.valid_admin_session()
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  headers jsonb;
  token text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;

  token := coalesce(
    headers ->> 'x-admin-session-token',
    headers ->> 'X-Admin-Session-Token'
  );

  if token is null or length(token) < 16 then
    return false;
  end if;

  delete from private.admin_sessions where expires_at <= now();

  return exists (
    select 1
    from private.admin_sessions
    where session_token = token
      and expires_at > now()
  );
end;
$$;

create or replace function public.admin_credential_configured()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.system
    where key = 'admin_credential'
      and status is not null
      and position(':' in status) > 1
      and length(split_part(status, ':', 2)) > 20
  );
$$;

create or replace function public.login_admin_session(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  credential text;
  stored_username text;
  stored_hash text;
  session_token text;
begin
  select status into credential
  from public.system
  where key = 'admin_credential';

  if credential is null or position(':' in credential) <= 1 then
    return null;
  end if;

  stored_username := split_part(credential, ':', 1);
  stored_hash := substring(credential from position(':' in credential) + 1);

  if stored_username is distinct from p_username then
    return null;
  end if;

  if stored_hash is null or extensions.crypt(p_password, stored_hash) <> stored_hash then
    return null;
  end if;

  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.admin_sessions (session_token, expires_at)
  values (session_token, now() + interval '8 hours');

  return session_token;
end;
$$;

create or replace function public.login_team(p_name text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  team_row public.teams%rowtype;
begin
  select * into team_row
  from public.teams
  where lower(name) = lower(p_name)
    and password = p_password
  limit 1;

  if team_row.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid credentials');
  end if;

  return jsonb_build_object(
    'success', true,
    'role', 'player',
    'teamId', team_row.id,
    'teamName', team_row.name
  );
end;
$$;

create or replace function public.matchmaking_queue_no_self_match()
returns trigger
language plpgsql
as $$
begin
  if new.matched_with is not null and new.team_id = new.matched_with then
    raise exception 'matchmaking queue row cannot match a team with itself';
  end if;
  return new;
end;
$$;

create or replace function public.active_matches_strip_team_snapshots()
returns trigger
language plpgsql
as $$
begin
  if new."teamA" is not null then
    new."teamA" := new."teamA" - 'password';
  end if;

  if new."teamB" is not null then
    new."teamB" := new."teamB" - 'password';
  end if;

  return new;
end;
$$;

create or replace function public.active_matches_prevent_duplicate()
returns trigger
language plpgsql
as $$
begin
  if new.team_a = new.team_b then
    raise exception 'active match cannot use the same team twice';
  end if;

  if exists (
    select 1
    from public.active_matches
    where id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        team_a in (new.team_a, new.team_b)
        or team_b in (new.team_a, new.team_b)
      )
  ) then
    raise exception 'one or both teams already have an active match';
  end if;

  return new;
end;
$$;

create or replace function public.active_matches_sync_team_status()
returns trigger
language plpgsql
as $$
begin
  update public.teams
  set status = 'fighting',
      timeout_until = null
  where id in (new.team_a, new.team_b);

  return new;
end;
$$;

create or replace function public.active_matches_clear_queue_rows()
returns trigger
language plpgsql
as $$
begin
  delete from public.matchmaking_queue
  where team_id in (new.team_a, new.team_b)
     or matched_with in (new.team_a, new.team_b);

  return new;
end;
$$;

create or replace function public.guard_active_team_runtime_edit()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.active_matches
    where team_a = old.id or team_b = old.id
  ) then
    if tg_op = 'UPDATE'
      and old.name is not distinct from new.name
      and old.member_names is not distinct from new.member_names
      and old.leader is not distinct from new.leader
      and old.password is not distinct from new.password
      and old.tokens is not distinct from new.tokens
      and new.status = 'fighting'
      and new.timeout_until is null then
      return new;
    end if;

    raise exception 'active-match teams cannot be edited or deleted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.declare_match_winner(
  p_match_id uuid,
  p_winner_id uuid,
  p_timestamp text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  match_row public.active_matches%rowtype;
  winner_row public.teams%rowtype;
  loser_row public.teams%rowtype;
  loser_id uuid;
  phase_value text;
  is_wager_match boolean;
  winner_tokens integer;
  loser_tokens integer;
begin
  if not public.valid_admin_session() then
    raise exception 'valid admin session required';
  end if;

  delete from public.active_matches
  where id = p_match_id
    and p_winner_id in (team_a, team_b)
  returning * into match_row;

  if match_row.id is null then
    raise exception 'active match not found for winner declaration';
  end if;

  loser_id := case
    when match_row.team_a = p_winner_id then match_row.team_b
    else match_row.team_a
  end;

  select * into winner_row from public.teams where id = p_winner_id for update;
  select * into loser_row from public.teams where id = loser_id for update;

  if winner_row.id is null or loser_row.id is null then
    raise exception 'winner or loser team not found';
  end if;

  select coalesce(phase, 'phase1') into phase_value
  from public.system
  where key = 'game';

  is_wager_match := coalesce(match_row.is_wager, false) or phase_value = 'phase2';

  if is_wager_match then
    winner_tokens := coalesce(winner_row.tokens, 0) + coalesce(loser_row.tokens, 0);
    loser_tokens := 0;

    update public.teams
    set tokens = winner_tokens,
        status = 'idle',
        timeout_until = null,
        last_token_update_time = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    where id = winner_row.id;

    update public.teams
    set tokens = 0,
        status = 'eliminated',
        timeout_until = null,
        last_token_update_time = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    where id = loser_row.id;
  else
    winner_tokens := coalesce(winner_row.tokens, 0) + 1;
    loser_tokens := greatest(0, coalesce(loser_row.tokens, 0) - 1);

    update public.teams
    set tokens = winner_tokens,
        status = 'idle',
        timeout_until = null,
        last_token_update_time = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    where id = winner_row.id;

    update public.teams
    set tokens = loser_tokens,
        status = case when loser_tokens = 0 then 'timeout' else 'idle' end,
        timeout_until = case
          when loser_tokens = 0 then floor(extract(epoch from clock_timestamp()) * 1000)::bigint + 300000
          else null
        end,
        last_token_update_time = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    where id = loser_row.id;
  end if;

  insert into public.match_history (winner, loser, winner_id, loser_id, domain, "timestamp", is_wager)
  values (winner_row.name, loser_row.name, winner_row.id, loser_row.id, match_row.domain, p_timestamp, is_wager_match);

  insert into public.notifications (message, "time")
  values (winner_row.name || ' defeated ' || loser_row.name, p_timestamp);

  insert into public.token_history (team, change, reason, "timestamp")
  values
    (winner_row.name, '+' || (winner_tokens - coalesce(winner_row.tokens, 0))::text, 'Match win', p_timestamp),
    (loser_row.name, '-' || (coalesce(loser_row.tokens, 0) - loser_tokens)::text, 'Match loss', p_timestamp);

  delete from public.matchmaking_queue
  where team_id in (winner_row.id, loser_row.id)
     or matched_with in (winner_row.id, loser_row.id);

  if winner_tokens > 0 then
    insert into public.matchmaking_queue (team_id, team_name, team_tokens, matched_with)
    values (winner_row.id, winner_row.name, winner_tokens, null)
    on conflict (team_id) do update
    set team_name = excluded.team_name,
        team_tokens = excluded.team_tokens,
        matched_with = null;
  end if;

  return jsonb_build_object(
    'matchId', match_row.id,
    'winnerId', winner_row.id,
    'loserId', loser_row.id,
    'winnerTokens', winner_tokens,
    'loserTokens', loser_tokens,
    'loserStatus', case when is_wager_match then 'eliminated' when loser_tokens = 0 then 'timeout' else 'idle' end,
    'isWager', is_wager_match
  );
end;
$$;

create trigger matchmaking_queue_no_self_match
before insert or update on public.matchmaking_queue
for each row execute function public.matchmaking_queue_no_self_match();

create trigger active_matches_strip_team_snapshots
before insert or update on public.active_matches
for each row execute function public.active_matches_strip_team_snapshots();

create trigger active_matches_prevent_duplicate
before insert or update on public.active_matches
for each row execute function public.active_matches_prevent_duplicate();

create trigger active_matches_sync_team_status
after insert on public.active_matches
for each row execute function public.active_matches_sync_team_status();

create trigger active_matches_clear_queue_rows
after insert on public.active_matches
for each row execute function public.active_matches_clear_queue_rows();

create trigger teams_guard_active_runtime_edit
before update or delete on public.teams
for each row execute function public.guard_active_team_runtime_edit();

alter table public.teams enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.active_matches enable row level security;
alter table public.match_history enable row level security;
alter table public.notifications enable row level security;
alter table public.token_history enable row level security;
alter table public.system enable row level security;

drop policy if exists teams_select on public.teams;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_update on public.teams;
drop policy if exists teams_delete on public.teams;
drop policy if exists matchmaking_queue_select on public.matchmaking_queue;
drop policy if exists matchmaking_queue_insert on public.matchmaking_queue;
drop policy if exists matchmaking_queue_update on public.matchmaking_queue;
drop policy if exists matchmaking_queue_delete on public.matchmaking_queue;
drop policy if exists active_matches_select on public.active_matches;
drop policy if exists active_matches_insert on public.active_matches;
drop policy if exists active_matches_update on public.active_matches;
drop policy if exists active_matches_delete on public.active_matches;
drop policy if exists match_history_select on public.match_history;
drop policy if exists match_history_insert on public.match_history;
drop policy if exists match_history_update on public.match_history;
drop policy if exists match_history_delete on public.match_history;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
drop policy if exists token_history_select on public.token_history;
drop policy if exists token_history_insert on public.token_history;
drop policy if exists token_history_update on public.token_history;
drop policy if exists token_history_delete on public.token_history;
drop policy if exists system_select on public.system;
drop policy if exists system_insert on public.system;
drop policy if exists system_update on public.system;
drop policy if exists system_delete on public.system;

create policy teams_select on public.teams
for select to anon, authenticated
using (true);

create policy teams_insert on public.teams
for insert to anon, authenticated
with check (public.valid_admin_session());

create policy teams_update on public.teams
for update to anon, authenticated
using (public.valid_admin_session())
with check (public.valid_admin_session());

create policy teams_delete on public.teams
for delete to anon, authenticated
using (public.valid_admin_session());

create policy matchmaking_queue_select on public.matchmaking_queue
for select to anon, authenticated
using (true);

create policy matchmaking_queue_insert on public.matchmaking_queue
for insert to anon, authenticated
with check (public.valid_admin_session());

create policy matchmaking_queue_update on public.matchmaking_queue
for update to anon, authenticated
using (public.valid_admin_session())
with check (public.valid_admin_session());

create policy matchmaking_queue_delete on public.matchmaking_queue
for delete to anon, authenticated
using (public.valid_admin_session());

create policy active_matches_select on public.active_matches
for select to anon, authenticated
using (true);

create policy active_matches_insert on public.active_matches
for insert to anon, authenticated
with check (public.valid_admin_session());

create policy active_matches_update on public.active_matches
for update to anon, authenticated
using (public.valid_admin_session())
with check (public.valid_admin_session());

create policy active_matches_delete on public.active_matches
for delete to anon, authenticated
using (public.valid_admin_session());

create policy match_history_select on public.match_history
for select to anon, authenticated
using (true);

create policy match_history_insert on public.match_history
for insert to anon, authenticated
with check (public.valid_admin_session());

create policy match_history_update on public.match_history
for update to anon, authenticated
using (public.valid_admin_session())
with check (public.valid_admin_session());

create policy match_history_delete on public.match_history
for delete to anon, authenticated
using (public.valid_admin_session());

create policy notifications_select on public.notifications
for select to anon, authenticated
using (true);

create policy notifications_insert on public.notifications
for insert to anon, authenticated
with check (public.valid_admin_session());

create policy notifications_update on public.notifications
for update to anon, authenticated
using (public.valid_admin_session())
with check (public.valid_admin_session());

create policy notifications_delete on public.notifications
for delete to anon, authenticated
using (public.valid_admin_session());

create policy token_history_select on public.token_history
for select to anon, authenticated
using (true);

create policy token_history_insert on public.token_history
for insert to anon, authenticated
with check (public.valid_admin_session());

create policy token_history_update on public.token_history
for update to anon, authenticated
using (public.valid_admin_session())
with check (public.valid_admin_session());

create policy token_history_delete on public.token_history
for delete to anon, authenticated
using (public.valid_admin_session());

create policy system_select on public.system
for select to anon, authenticated
using (key = 'game');

create policy system_insert on public.system
for insert to anon, authenticated
with check (false);

create policy system_update on public.system
for update to anon, authenticated
using (key = 'game' and public.valid_admin_session())
with check (key = 'game' and public.valid_admin_session());

create policy system_delete on public.system
for delete to anon, authenticated
using (false);

revoke all on all tables in schema public from anon, authenticated;
revoke all on private.admin_sessions from anon, authenticated;

grant select (id, name, member_names, leader, tokens, status, total_time, timeout_until, last_token_update_time, created_at)
on public.teams to anon, authenticated;
grant insert, update, delete on public.teams to anon, authenticated;

grant select, insert, update, delete on public.matchmaking_queue to anon, authenticated;
grant select, insert, update, delete on public.active_matches to anon, authenticated;
grant select, insert, update, delete on public.match_history to anon, authenticated;
grant select, insert, update, delete on public.notifications to anon, authenticated;
grant select, insert, update, delete on public.token_history to anon, authenticated;
grant select, insert, update, delete on public.system to anon, authenticated;

grant execute on function public.login_team(text, text) to anon, authenticated;
grant execute on function public.login_admin_session(text, text) to anon, authenticated;
grant execute on function public.valid_admin_session() to anon, authenticated;
grant execute on function public.admin_credential_configured() to anon, authenticated;
grant execute on function public.declare_match_winner(uuid, uuid, text) to anon, authenticated;

commit;

-- Optional verification query:
-- select schemaname, tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
