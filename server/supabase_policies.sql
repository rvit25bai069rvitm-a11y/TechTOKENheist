-- Tech Token Heist - Supabase access setup
-- Run this in Supabase SQL Editor for the project used by the frontend.

begin;

-- 1) Ensure anon/authenticated roles can access the public schema and tables
grant usage on schema public to anon, authenticated;
grant all privileges on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- 2) Enable RLS on all tables used by the app
alter table if exists public.teams enable row level security;
alter table if exists public.matchmaking_queue enable row level security;
alter table if exists public.active_matches enable row level security;
alter table if exists public.match_history enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.token_history enable row level security;
alter table if exists public.system enable row level security;

-- 3) Remove old policies (if any)
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

-- 4) Open policies for anon/authenticated so frontend can read/write all gameplay data
create policy teams_select on public.teams
for select to anon, authenticated
using (true);

create policy teams_insert on public.teams
for insert to anon, authenticated
with check (true);

create policy teams_update on public.teams
for update to anon, authenticated
using (true)
with check (true);

create policy teams_delete on public.teams
for delete to anon, authenticated
using (true);

create policy matchmaking_queue_select on public.matchmaking_queue
for select to anon, authenticated
using (true);

create policy matchmaking_queue_insert on public.matchmaking_queue
for insert to anon, authenticated
with check (true);

create policy matchmaking_queue_update on public.matchmaking_queue
for update to anon, authenticated
using (true)
with check (true);

create policy matchmaking_queue_delete on public.matchmaking_queue
for delete to anon, authenticated
using (true);

create policy active_matches_select on public.active_matches
for select to anon, authenticated
using (true);

create policy active_matches_insert on public.active_matches
for insert to anon, authenticated
with check (true);

create policy active_matches_update on public.active_matches
for update to anon, authenticated
using (true)
with check (true);

create policy active_matches_delete on public.active_matches
for delete to anon, authenticated
using (true);

create policy match_history_select on public.match_history
for select to anon, authenticated
using (true);

create policy match_history_insert on public.match_history
for insert to anon, authenticated
with check (true);

create policy match_history_update on public.match_history
for update to anon, authenticated
using (true)
with check (true);

create policy match_history_delete on public.match_history
for delete to anon, authenticated
using (true);

create policy notifications_select on public.notifications
for select to anon, authenticated
using (true);

create policy notifications_insert on public.notifications
for insert to anon, authenticated
with check (true);

create policy notifications_update on public.notifications
for update to anon, authenticated
using (true)
with check (true);

create policy notifications_delete on public.notifications
for delete to anon, authenticated
using (true);

create policy token_history_select on public.token_history
for select to anon, authenticated
using (true);

create policy token_history_insert on public.token_history
for insert to anon, authenticated
with check (true);

create policy token_history_update on public.token_history
for update to anon, authenticated
using (true)
with check (true);

create policy token_history_delete on public.token_history
for delete to anon, authenticated
using (true);

create policy system_select on public.system
for select to anon, authenticated
using (true);

create policy system_insert on public.system
for insert to anon, authenticated
with check (true);

create policy system_update on public.system
for update to anon, authenticated
using (true)
with check (true);

create policy system_delete on public.system
for delete to anon, authenticated
using (true);

commit;

-- Optional verification query:
-- select schemaname, tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;