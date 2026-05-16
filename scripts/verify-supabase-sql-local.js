import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import process from 'node:process'

const containerName = `tth-supabase-sql-${process.pid}-${Date.now()}`
const postgresImage = process.env.VERIFY_POSTGRES_IMAGE || 'postgres:16-alpine'
const adminPassword = `local-secret-${crypto.randomBytes(6).toString('hex')}`
const maxBuffer = 20 * 1024 * 1024

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer,
    ...options,
  })

  if (options.allowFailure) {
    return result
  }

  if (options.expectFailure) {
    if (result.status === 0) {
      throw new Error(`${options.label || command} was expected to fail, but it succeeded.\n${result.stdout}`)
    }
    return result
  }

  if (result.status !== 0) {
    throw new Error([
      `${options.label || command} failed with exit code ${result.status}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'))
  }

  return result
}

const docker = (args, options = {}) => run('docker', args, options)

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`

const runPsql = (sql, options = {}) => {
  const args = [
    'exec',
    '-i',
    containerName,
    'psql',
    '-X',
    '-q',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ]

  if (options.tuplesOnly) {
    args.push('-t', '-A')
  }

  return docker(args, {
    input: sql,
    label: options.label || 'psql',
    expectFailure: options.expectFailure,
  })
}

const firstUuidFrom = (stdout, label) => {
  const match = stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (!match) throw new Error(`Could not parse ${label} UUID from psql output:\n${stdout}`)
  return match[0]
}

const scalarFrom = (stdout, label) => {
  const value = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!value) throw new Error(`Could not parse ${label} from psql output:\n${stdout}`)
  return value
}

const assertScalar = (sql, expected, label) => {
  const output = runPsql(sql, { tuplesOnly: true, label }).stdout
  const actual = scalarFrom(output, label)
  if (actual !== String(expected)) {
    throw new Error(`${label} expected ${expected}, got ${actual}`)
  }
}

const adminHeaderSql = (token) => [
  'set role anon;',
  `set request.headers = ${sqlLiteral(JSON.stringify({ 'x-admin-session-token': token }))};`,
].join('\n')

const invalidAdminHeaderSql = () => [
  'set role anon;',
  `set request.headers = ${sqlLiteral(JSON.stringify({ 'x-admin-session-token': 'not-a-real-admin-session' }))};`,
].join('\n')

const verifyAnonymousWriteGuards = ({ teamAId, teamBId, matchId = null }) => {
  if (matchId) {
    assertScalar(`
      set role anon;
      with attempted as (
        delete from public.active_matches
        where id = ${sqlLiteral(matchId)}::uuid
        returning id
      )
      select count(*)::text from attempted;
    `, '0', 'anon active_matches delete without admin session')
    return
  }

  runPsql(`
    ${invalidAdminHeaderSql()}
    insert into public.teams (name, member_names, leader, password, tokens, status)
    values ('__invalid_admin_header__', array['invalid']::text[], 'invalid', 'invalid-password', 1, 'idle');
  `, { expectFailure: true, label: 'invalid admin-header team insert' })

  assertScalar(`
    set role anon;
    with attempted as (
      update public.teams
      set status = 'queued'
      where id = ${sqlLiteral(teamAId)}::uuid
      returning id
    )
    select count(*)::text from attempted;
  `, '0', 'anon teams update without admin session')

  assertScalar(`
    set role anon;
    with attempted as (
      delete from public.teams
      where id = ${sqlLiteral(teamAId)}::uuid
      returning id
    )
    select count(*)::text from attempted;
  `, '0', 'anon teams delete without admin session')

  runPsql(`
    set role anon;
    insert into public.matchmaking_queue (team_id, team_name, team_tokens, matched_with)
    values (${sqlLiteral(teamAId)}::uuid, '__local_alpha__', 1, null);
  `, { expectFailure: true, label: 'anon matchmaking_queue insert without admin session' })

  assertScalar(`
    set role anon;
    with attempted as (
      update public.matchmaking_queue
      set matched_with = null
      where team_id = ${sqlLiteral(teamAId)}::uuid
      returning id
    )
    select count(*)::text from attempted;
  `, '0', 'anon matchmaking_queue update without admin session')

  assertScalar(`
    set role anon;
    with attempted as (
      delete from public.matchmaking_queue
      where team_id = ${sqlLiteral(teamAId)}::uuid
      returning id
    )
    select count(*)::text from attempted;
  `, '0', 'anon matchmaking_queue delete without admin session')

  runPsql(`
    set role anon;
    insert into public.active_matches (team_a, team_b, domain, start_time, is_wager)
    values (${sqlLiteral(teamAId)}::uuid, ${sqlLiteral(teamBId)}::uuid, 'Tech Pitch', 1000, false);
  `, { expectFailure: true, label: 'anon active_matches insert without admin session' })

  runPsql(`
    set role anon;
    insert into public.match_history (winner, loser, winner_id, loser_id, domain, timestamp, is_wager)
    values ('__local_alpha__', '__local_bravo__', ${sqlLiteral(teamAId)}::uuid, ${sqlLiteral(teamBId)}::uuid, 'Tech Pitch', 'LOCAL_VERIFY', false);
  `, { expectFailure: true, label: 'anon match_history insert without admin session' })

  runPsql(`
    set role anon;
    insert into public.notifications (message, time)
    values ('blocked notification', 'LOCAL_VERIFY');
  `, { expectFailure: true, label: 'anon notifications insert without admin session' })

  runPsql(`
    set role anon;
    insert into public.token_history (team, change, reason, timestamp)
    values ('__local_alpha__', '+1', 'blocked', 'LOCAL_VERIFY');
  `, { expectFailure: true, label: 'anon token_history insert without admin session' })

  assertScalar(`
    set role anon;
    with attempted as (
      update public.system
      set status = 'blocked'
      where key = 'game'
      returning key
    )
    select count(*)::text from attempted;
  `, '0', 'anon system update without admin session')
}

const verify = () => {
  console.log(`Starting local Postgres container ${containerName} (${postgresImage})...`)
  docker(['run', '--rm', '--name', containerName, '-e', 'POSTGRES_PASSWORD=postgres', '-d', postgresImage], {
    label: 'docker run postgres',
  })

  let ready = false
  let consecutiveReadyChecks = 0
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const pgReady = docker(['exec', containerName, 'pg_isready', '-U', 'postgres'], {
      allowFailure: true,
      label: 'pg_isready',
    })

    const queryReady = docker([
      'exec',
      containerName,
      'psql',
      '-X',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      'select 1;',
    ], {
      allowFailure: true,
      label: 'psql readiness query',
    })

    if (pgReady.status === 0 && queryReady.status === 0) {
      consecutiveReadyChecks += 1
    } else {
      consecutiveReadyChecks = 0
    }

    if (consecutiveReadyChecks >= 4) {
      ready = true
      break
    }
    sleep(500)
  }

  if (!ready) {
    const status = docker(['ps', '-a', '--filter', `name=${containerName}`, '--format', '{{.Status}}'], {
      allowFailure: true,
      label: 'docker ps status',
    })
    const logs = docker(['logs', '--tail', '80', containerName], {
      allowFailure: true,
      label: 'docker logs',
    })
    throw new Error([
      'Local Postgres container did not become ready.',
      status.stdout,
      logs.stdout,
      logs.stderr,
    ].filter(Boolean).join('\n'))
  }

  const policySql = fs.readFileSync(new URL('../server/supabase_policies.sql', import.meta.url), 'utf8')
  runPsql([
    'create role anon nologin;',
    'create role authenticated nologin;',
    policySql,
  ].join('\n'), { label: 'Supabase policy SQL compile' })
  console.log('Supabase policy SQL compiled in local Postgres.')

  runPsql(`
    update public.system
    set status = 'active',
        is_game_active = true,
        is_paused = false,
        phase = 'phase1',
        game_started_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint
    where key = 'game';

    update public.system
    set status = 'admin:' || extensions.crypt(${sqlLiteral(adminPassword)}, extensions.gen_salt('bf'))
    where key = 'admin_credential';
  `, { label: 'configure local admin credential' })

  runPsql(`
    set role anon;
    insert into public.teams (name, member_names, leader, password, tokens, status)
    values ('__anon_blocked__', array['anon']::text[], 'anon', 'blocked-password', 1, 'idle');
  `, { expectFailure: true, label: 'anon team insert without admin session' })

  const token = scalarFrom(runPsql(`
    set role anon;
    select public.login_admin_session('admin', ${sqlLiteral(adminPassword)});
  `, { tuplesOnly: true, label: 'login_admin_session local check' }).stdout, 'admin session token')

  assertScalar(`
    set role anon;
    select public.admin_credential_configured()::text;
  `, 'true', 'admin credential configured RPC')

  runPsql(`
    set role anon;
    select password from public.teams limit 1;
  `, { expectFailure: true, label: 'anon password column read' })

  const teamAId = firstUuidFrom(runPsql(`
    ${adminHeaderSql(token)}
    insert into public.teams (name, member_names, leader, password, tokens, status)
    values ('__local_alpha__', array['alpha']::text[], 'alpha', 'alpha-password', 1, 'idle')
    returning id;
  `, { tuplesOnly: true, label: 'admin-header team A insert' }).stdout, 'team A')

  const teamBId = firstUuidFrom(runPsql(`
    ${adminHeaderSql(token)}
    insert into public.teams (name, member_names, leader, password, tokens, status)
    values ('__local_bravo__', array['bravo']::text[], 'bravo', 'bravo-password', 1, 'idle')
    returning id;
  `, { tuplesOnly: true, label: 'admin-header team B insert' }).stdout, 'team B')

  runPsql(`
    ${adminHeaderSql(token)}
    insert into public.matchmaking_queue (team_id, team_name, team_tokens, matched_with)
    values
      (${sqlLiteral(teamAId)}::uuid, '__local_alpha__', 1, ${sqlLiteral(teamBId)}::uuid),
      (${sqlLiteral(teamBId)}::uuid, '__local_bravo__', 1, ${sqlLiteral(teamAId)}::uuid);
  `, { label: 'admin-header queue pair insert' })

  runPsql(`
    ${adminHeaderSql(token)}
    update public.matchmaking_queue
    set matched_with = team_id
    where team_id = ${sqlLiteral(teamAId)}::uuid;
  `, { expectFailure: true, label: 'self matchmaking queue lock guard' })

  verifyAnonymousWriteGuards({ teamAId, teamBId })

  const matchId = firstUuidFrom(runPsql(`
    ${adminHeaderSql(token)}
    insert into public.active_matches (team_a, team_b, domain, start_time, is_wager, "teamA", "teamB")
    values (
      ${sqlLiteral(teamAId)}::uuid,
      ${sqlLiteral(teamBId)}::uuid,
      'Tech Pitch',
      1000,
      false,
      jsonb_build_object('id', ${sqlLiteral(teamAId)}, 'name', '__local_alpha__', 'password', 'leaked-alpha-password'),
      jsonb_build_object('id', ${sqlLiteral(teamBId)}, 'name', '__local_bravo__', 'password', 'leaked-bravo-password')
    )
    returning id;
  `, { tuplesOnly: true, label: 'active match insert' }).stdout, 'active match')

  verifyAnonymousWriteGuards({ teamAId, teamBId, matchId })

  assertScalar(`
    set role anon;
    select (coalesce("teamA" ? 'password', false) or coalesce("teamB" ? 'password', false))::text
    from public.active_matches
    where id = ${sqlLiteral(matchId)}::uuid;
  `, 'false', 'active-match team snapshot password stripping')

  assertScalar(`
    set role anon;
    select count(*)::text from public.teams
    where id in (${sqlLiteral(teamAId)}::uuid, ${sqlLiteral(teamBId)}::uuid)
      and status = 'fighting';
  `, '2', 'active-match status sync')

  assertScalar(`
    set role anon;
    select count(*)::text
    from public.matchmaking_queue
    where team_id in (${sqlLiteral(teamAId)}::uuid, ${sqlLiteral(teamBId)}::uuid)
       or matched_with in (${sqlLiteral(teamAId)}::uuid, ${sqlLiteral(teamBId)}::uuid);
  `, '0', 'active-match queue cleanup')

  runPsql(`
    ${adminHeaderSql(token)}
    insert into public.active_matches (team_a, team_b, domain, start_time, is_wager)
    values (${sqlLiteral(teamAId)}::uuid, ${sqlLiteral(teamBId)}::uuid, 'Tech Quiz', 2000, false);
  `, { expectFailure: true, label: 'duplicate active match guard' })

  runPsql(`
    ${adminHeaderSql(token)}
    update public.teams
    set tokens = 2
    where id = ${sqlLiteral(teamAId)}::uuid;
  `, { expectFailure: true, label: 'active-match runtime edit guard' })

  runPsql(`
    ${adminHeaderSql(token)}
    delete from public.teams
    where id = ${sqlLiteral(teamAId)}::uuid;
  `, { expectFailure: true, label: 'active-match team delete guard' })

  runPsql(`
    ${adminHeaderSql(token)}
    select public.declare_match_winner(
      ${sqlLiteral(matchId)}::uuid,
      ${sqlLiteral(teamAId)}::uuid,
      'LOCAL_VERIFY'
    )::text;
  `, { tuplesOnly: true, label: 'declare_match_winner local check' })

  assertScalar(`
    set role anon;
    select count(*)::text from public.active_matches where id = ${sqlLiteral(matchId)}::uuid;
  `, '0', 'active match deleted after winner declaration')

  assertScalar(`
    set role anon;
    select tokens::text || ':' || status
    from public.teams
    where id = ${sqlLiteral(teamAId)}::uuid;
  `, '2:idle', 'winner token/status state')

  assertScalar(`
    set role anon;
    select tokens::text || ':' || status || ':' || (timeout_until is not null)::text
    from public.teams
    where id = ${sqlLiteral(teamBId)}::uuid;
  `, '0:timeout:true', 'loser token/status state')

  assertScalar(`
    set role anon;
    select count(*)::text
    from public.match_history
    where winner_id = ${sqlLiteral(teamAId)}::uuid
      and loser_id = ${sqlLiteral(teamBId)}::uuid
      and domain = 'Tech Pitch';
  `, '1', 'match history insert')

  assertScalar(`
    set role anon;
    select count(*)::text
    from public.matchmaking_queue
    where team_id = ${sqlLiteral(teamAId)}::uuid;
  `, '1', 'winner queue re-enrollment')

  assertScalar(`
    set role anon;
    select count(*)::text
    from public.matchmaking_queue
    where team_id = ${sqlLiteral(teamBId)}::uuid;
  `, '0', 'timeout loser queue exclusion')

  const teamCId = firstUuidFrom(runPsql(`
    ${adminHeaderSql(token)}
    insert into public.teams (name, member_names, leader, password, tokens, status)
    values ('__local_charlie__', array['charlie']::text[], 'charlie', 'charlie-password', 3, 'idle')
    returning id;
  `, { tuplesOnly: true, label: 'admin-header team C insert' }).stdout, 'team C')

  const teamDId = firstUuidFrom(runPsql(`
    ${adminHeaderSql(token)}
    insert into public.teams (name, member_names, leader, password, tokens, status)
    values ('__local_delta__', array['delta']::text[], 'delta', 'delta-password', 1, 'idle')
    returning id;
  `, { tuplesOnly: true, label: 'admin-header team D insert' }).stdout, 'team D')

  const carriedMatchId = firstUuidFrom(runPsql(`
    ${adminHeaderSql(token)}
    insert into public.active_matches (team_a, team_b, domain, start_time, is_wager)
    values (${sqlLiteral(teamCId)}::uuid, ${sqlLiteral(teamDId)}::uuid, 'Tech Quiz', 3000, false)
    returning id;

    update public.system
    set phase = 'phase2'
    where key = 'game';
  `, { tuplesOnly: true, label: 'phase transition active match setup' }).stdout, 'phase transition active match')

  runPsql(`
    ${adminHeaderSql(token)}
    select public.declare_match_winner(
      ${sqlLiteral(carriedMatchId)}::uuid,
      ${sqlLiteral(teamCId)}::uuid,
      'LOCAL_PHASE_VERIFY'
    )::text;
  `, { tuplesOnly: true, label: 'phase transition declare_match_winner local check' })

  assertScalar(`
    set role anon;
    select tokens::text || ':' || status
    from public.teams
    where id = ${sqlLiteral(teamCId)}::uuid;
  `, '4:idle', 'phase transition winner wager state')

  assertScalar(`
    set role anon;
    select tokens::text || ':' || status || ':' || (timeout_until is null)::text
    from public.teams
    where id = ${sqlLiteral(teamDId)}::uuid;
  `, '0:eliminated:true', 'phase transition loser wager state')

  assertScalar(`
    set role anon;
    select is_wager::text
    from public.match_history
    where winner_id = ${sqlLiteral(teamCId)}::uuid
      and loser_id = ${sqlLiteral(teamDId)}::uuid
      and domain = 'Tech Quiz';
  `, 'true', 'phase transition history wager flag')

  assertScalar(`
    set role anon;
    select count(*)::text
    from public.system
    where key = 'admin_credential';
  `, '0', 'admin credential hidden by RLS')

  console.log('Local Supabase SQL verification passed.')
}

try {
  verify()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  docker(['rm', '-f', containerName], {
    allowFailure: true,
    label: 'docker cleanup',
  })
}
