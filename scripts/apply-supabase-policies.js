import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'
import {
  normalizeEnvValue,
  parseEnvFile,
  redactCliOutput,
} from './vercel-env-utils.js'

const postgresImage = process.env.VERIFY_POSTGRES_IMAGE || 'postgres:16-alpine'
const maxBuffer = 20 * 1024 * 1024
const CONFIG_ENV = [
  'APPLY_SUPABASE_POLICIES',
  'SUPABASE_DB_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
  'VITE_SUPABASE_URL',
  'EXPECTED_SUPABASE_URL',
  'EVENT_ADMIN_USERNAME',
  'EVENT_ADMIN_PASSWORD',
  'VERIFY_SUPABASE_ADMIN_USERNAME',
  'VERIFY_SUPABASE_ADMIN_PASSWORD',
]

const usage = `Apply hardened Supabase SQL to the event database.

Required environment:
  APPLY_SUPABASE_POLICIES=1
  SUPABASE_DB_URL=postgresql://...
  EVENT_ADMIN_USERNAME=...
  EVENT_ADMIN_PASSWORD=...

Fallback env names:
  DATABASE_URL or POSTGRES_URL for the database URL
  VERIFY_SUPABASE_ADMIN_USERNAME / VERIFY_SUPABASE_ADMIN_PASSWORD for the admin credential

Options:
  --from <path>  Read values from an env file. Process env overrides file values.
  --apply        Explicitly allow live policy application.
  --allow-local-db
                 Permit loopback/local database hosts for local rehearsals only.

The script uses local psql when available, otherwise Docker with ${postgresImage}.
`

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const parseArgs = (argv) => {
  const options = {
    allowLocalDb: false,
    apply: false,
    from: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--allow-local-db') {
      options.allowLocalDb = true
    } else if (arg === '--from') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
        console.error('--from requires an env file path.')
        console.error(usage)
        process.exit(1)
      }
      options.from = argv[index + 1]
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage)
      process.exit(0)
    } else {
      console.error(`Unknown argument: ${arg}`)
      console.error(usage)
      process.exit(1)
    }
  }

  return options
}

const loadSourceValues = (filePath) => {
  const fileValues = {}
  if (filePath) {
    const absolutePath = resolve(filePath)
    if (!existsSync(absolutePath)) {
      fail(`Env file not found: ${absolutePath}`)
    }
    Object.assign(fileValues, parseEnvFile(readFileSync(absolutePath, 'utf8')))
  }

  const processValues = Object.fromEntries(
    CONFIG_ENV
      .map((key) => [key, normalizeEnvValue(process.env[key])])
      .filter(([, value]) => Boolean(value))
  )

  return {
    ...fileValues,
    ...processValues,
  }
}

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`

const isLocalDatabaseHost = (hostname) => {
  const normalized = String(hostname || '').toLowerCase()
  return normalized === 'localhost' ||
    normalized === 'host.docker.internal' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized.startsWith('127.')
}

const getSupabaseProjectRef = (value) => {
  const raw = normalizeEnvValue(value)
  if (!raw) return null

  try {
    const parsed = new URL(raw)
    const hostname = parsed.hostname.toLowerCase()
    if (!hostname.endsWith('.supabase.co')) return null
    const projectRef = hostname.replace(/\.supabase\.co$/, '')
    if (!projectRef || ['project-ref', 'your-project-ref', 'your-project', 'example'].includes(projectRef)) return null
    return projectRef
  } catch {
    return null
  }
}

const validateDbUrl = (value, { allowLocalDb = false, expectedProjectRef = null } = {}) => {
  if (!value || ['<', '>', '[', ']'].some((token) => value.includes(token))) {
    return { ok: false, reason: 'missing' }
  }
  if (/(your-|project-ref|example|region)/i.test(value)) {
    return { ok: false, reason: 'placeholder' }
  }

  try {
    const parsed = new URL(value)
    const haystack = [
      parsed.hostname,
      parsed.username,
      parsed.pathname,
      parsed.search,
    ].join(' ').toLowerCase()

    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username) {
      return { ok: false, reason: 'format' }
    }

    if (!allowLocalDb && isLocalDatabaseHost(parsed.hostname)) {
      return { ok: false, reason: 'local' }
    }

    if (expectedProjectRef && !haystack.includes(expectedProjectRef.toLowerCase())) {
      return { ok: false, reason: 'project-mismatch' }
    }

    return { ok: true }
  } catch {
    return { ok: false, reason: 'format' }
  }
}

const validateAdminUsername = (value) => {
  const trimmed = String(value || '').trim()
  return trimmed.length > 0 && trimmed.length <= 80 && !trimmed.includes(':')
}

const placeholderAdminPasswords = new Set([
  'change-this-password',
  'replace-with-strong-event-password',
  'your-password',
  'example-password',
  'iamadmin',
  'admin',
  'password',
])

const validateAdminPassword = (value) => {
  const password = String(value || '').trim()
  return password.length >= 12 && !placeholderAdminPasswords.has(password.toLowerCase())
}

const options = parseArgs(process.argv.slice(2))
const sourceValues = loadSourceValues(options.from)
const dbUrl = sourceValues.SUPABASE_DB_URL || sourceValues.DATABASE_URL || sourceValues.POSTGRES_URL
const expectedSupabaseUrl = sourceValues.EXPECTED_SUPABASE_URL || sourceValues.VITE_SUPABASE_URL
const expectedProjectRef = getSupabaseProjectRef(expectedSupabaseUrl)
const adminUsername = sourceValues.EVENT_ADMIN_USERNAME || sourceValues.VERIFY_SUPABASE_ADMIN_USERNAME
const adminPassword = sourceValues.EVENT_ADMIN_PASSWORD || sourceValues.VERIFY_SUPABASE_ADMIN_PASSWORD
const applyEnabled = options.apply || sourceValues.APPLY_SUPABASE_POLICIES === '1'

const run = (command, args, options = {}) => spawnSync(command, args, {
  encoding: 'utf8',
  maxBuffer,
  ...options,
})

const isCommandAvailable = (command, args = ['--version']) => {
  const result = run(command, args, { allowFailure: true })
  return result.status === 0
}

const buildPsqlEnv = (connectionUrl) => {
  const parsed = new URL(connectionUrl)
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres'
  const sslMode = parsed.searchParams.get('sslmode') || 'require'

  return Object.fromEntries(Object.entries({
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || undefined,
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: database,
    PGSSLMODE: sslMode,
  }).filter(([, value]) => value !== undefined))
}

const runPsql = (sql) => {
  if (isCommandAvailable('psql')) {
    return run('psql', [
      '-X',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
    ], {
      input: sql,
      env: buildPsqlEnv(dbUrl),
    })
  }

  if (!isCommandAvailable('docker', ['--version'])) {
    fail('Neither psql nor Docker is available. Install one of them before applying Supabase policies.')
  }

  return run('docker', [
    'run',
    '--rm',
    '-i',
    '-e',
    'DATABASE_URL',
    postgresImage,
    'sh',
    '-c',
    'psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1',
  ], {
    input: sql,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
  })
}

const redactApplyOutput = (value) => {
  const secrets = [
    dbUrl,
    adminPassword,
    String(adminPassword || '').replaceAll("'", "''"),
  ].filter(Boolean)

  let redacted = redactCliOutput(value)
  for (const secret of secrets) {
    redacted = redacted.replaceAll(secret, '<redacted>')
  }

  return redacted.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://<redacted>')
}

const runPsqlOrFail = (sql, label) => {
  const result = runPsql(sql)
  if (result.status !== 0) {
    console.error(`${label} failed.`)
    console.error(redactApplyOutput(result.stderr || result.stdout))
    process.exit(result.status || 1)
  }
  return result
}

if (!applyEnabled) {
  fail('Refusing to apply live Supabase policies without APPLY_SUPABASE_POLICIES=1.')
}

if (normalizeEnvValue(expectedSupabaseUrl) && !expectedProjectRef) {
  fail('VITE_SUPABASE_URL or EXPECTED_SUPABASE_URL must be a real Supabase project URL when provided.')
}

const dbValidation = validateDbUrl(dbUrl, {
  allowLocalDb: options.allowLocalDb,
  expectedProjectRef,
})

if (!dbValidation.ok) {
  if (dbValidation.reason === 'local') {
    fail('Refusing to apply event policies to a local Postgres host. Use --allow-local-db only for local rehearsals.')
  }
  if (dbValidation.reason === 'project-mismatch') {
    fail('SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL does not match VITE_SUPABASE_URL or EXPECTED_SUPABASE_URL.')
  }
  fail('SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL must be a real non-placeholder Postgres connection URL.')
}

if (!validateAdminUsername(adminUsername)) {
  fail('EVENT_ADMIN_USERNAME is required and must not contain a colon.')
}

if (!validateAdminPassword(adminPassword)) {
  fail('EVENT_ADMIN_PASSWORD is required, must be at least 12 characters, and must not be a placeholder or known weak value.')
}

const policySql = readFileSync(new URL('../server/supabase_policies.sql', import.meta.url), 'utf8')
const configureAdminSql = `
update public.system
set status = ${sqlLiteral(adminUsername)} || ':' || extensions.crypt(${sqlLiteral(adminPassword)}, extensions.gen_salt('bf'))
where key = 'admin_credential';

do $$
begin
  if not public.admin_credential_configured() then
    raise exception 'admin credential was not configured';
  end if;
end $$;
`

const postApplyVerificationSql = `
do $$
declare
  session_token text;
begin
  if not public.admin_credential_configured() then
    raise exception 'admin credential is not configured';
  end if;

  session_token := public.login_admin_session(${sqlLiteral(adminUsername)}, ${sqlLiteral(adminPassword)});
  if session_token is null then
    raise exception 'admin login did not return a session token';
  end if;

  perform public.login_team('__apply_probe__', '__invalid__');
end $$;

set role anon;
do $$
begin
  if exists (select 1 from public.system where key = 'admin_credential') then
    raise exception 'admin credential row is visible to anon';
  end if;
end $$;
`

console.log('Applying Supabase policies to the configured database...')
runPsqlOrFail(policySql, 'Supabase policy SQL')
console.log('Configuring event admin credential...')
runPsqlOrFail(configureAdminSql, 'Admin credential configuration')

console.log('Verifying post-apply Supabase security checks...')
runPsqlOrFail(postApplyVerificationSql, 'Post-apply Supabase verification')

const passwordReadCheck = runPsql('set role anon; select password from public.teams limit 1;')
if (passwordReadCheck.status === 0) {
  console.error('Post-apply Supabase verification failed.')
  console.error('teams.password is still directly selectable through the Data API roles.')
  process.exit(1)
}

console.log('Supabase policies applied, event admin credential configured, and post-apply checks passed.')
