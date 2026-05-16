import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  normalizeEnvValue,
  parseEnvFile,
  redactCliOutput,
  validateAdminVerifierEnv,
  validateSupabaseProductionEnv,
} from './vercel-env-utils.js'

const DEFAULT_ENV_FILE = '.env.production.local'
const DEFAULT_OUTPUT_FILE = 'event-supabase-apply.local.sql'

const usage = `Usage:
  node scripts/render-supabase-event-sql.js [--from .env.production.local] [--out event-supabase-apply.local.sql]

Renders a local SQL Editor fallback file that applies server/supabase_policies.sql
and configures the event admin credential from the env file.

The output file contains the event admin password as a SQL literal. It is meant
for a one-time Supabase SQL Editor paste and is ignored by git when it ends with
.local.sql.`

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`

const parseArgs = (argv) => {
  const options = {
    from: DEFAULT_ENV_FILE,
    out: DEFAULT_OUTPUT_FILE,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--from') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
        throw new Error('--from requires an env file path.')
      }
      options.from = argv[index + 1]
      index += 1
    } else if (arg === '--out') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
        throw new Error('--out requires an output file path.')
      }
      options.out = argv[index + 1]
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage)
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

const loadEnvValues = (filePath) => {
  const absolutePath = resolve(filePath)
  if (!existsSync(absolutePath)) {
    throw new Error(`Env file not found: ${absolutePath}`)
  }

  return {
    ...parseEnvFile(readFileSync(absolutePath, 'utf8')),
    ...Object.fromEntries(
      [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'EVENT_ADMIN_USERNAME',
        'EVENT_ADMIN_PASSWORD',
        'VERIFY_SUPABASE_ADMIN_USERNAME',
        'VERIFY_SUPABASE_ADMIN_PASSWORD',
      ]
        .map((key) => [key, normalizeEnvValue(process.env[key])])
        .filter(([, value]) => Boolean(value))
    ),
  }
}

const assertValidValues = (values) => {
  const supabase = validateSupabaseProductionEnv(values)
  if (!supabase.ok) {
    const issues = [
      ...supabase.missing.map((key) => `${key} missing`),
      ...supabase.blank.map((key) => `${key} blank`),
      ...supabase.invalid.map((key) => `${key} invalid`),
    ]
    throw new Error(`Cannot render SQL with invalid Supabase env: ${issues.join(', ')}`)
  }

  const adminUsername = normalizeEnvValue(values.EVENT_ADMIN_USERNAME || values.VERIFY_SUPABASE_ADMIN_USERNAME)
  const adminPassword = normalizeEnvValue(values.EVENT_ADMIN_PASSWORD || values.VERIFY_SUPABASE_ADMIN_PASSWORD)
  const admin = validateAdminVerifierEnv({
    VERIFY_SUPABASE_ADMIN_USERNAME: adminUsername,
    VERIFY_SUPABASE_ADMIN_PASSWORD: adminPassword,
  })

  if (!admin.ok) {
    const issues = [
      ...admin.missing.map((key) => `${key} missing`),
      ...admin.invalid.map((key) => `${key} invalid`),
    ]
    throw new Error(`Cannot render SQL with invalid admin credential: ${issues.join(', ')}`)
  }

  return { adminUsername, adminPassword }
}

const renderSql = ({ policySql, supabaseUrl, adminUsername, adminPassword }) => `${policySql.trimEnd()}

-- Generated manual event admin credential step.
-- This file contains the admin password as a SQL literal. Apply it once in the
-- Supabase SQL Editor for ${redactCliOutput(supabaseUrl)}, then delete it.
update public.system
set status = ${sqlLiteral(`${adminUsername}:`)} || extensions.crypt(${sqlLiteral(adminPassword)}, extensions.gen_salt('bf'))
where key = 'admin_credential';

select public.admin_credential_configured() as admin_credential_configured;
`

try {
  const options = parseArgs(process.argv.slice(2))
  const values = loadEnvValues(options.from)
  const { adminUsername, adminPassword } = assertValidValues(values)
  const policySql = readFileSync(new URL('../server/supabase_policies.sql', import.meta.url), 'utf8')
  const outputPath = resolve(options.out)
  const sql = renderSql({
    policySql,
    supabaseUrl: normalizeEnvValue(values.VITE_SUPABASE_URL),
    adminUsername,
    adminPassword,
  })

  writeFileSync(outputPath, sql, { encoding: 'utf8', flag: 'w' })
  console.log(`Rendered Supabase SQL Editor fallback file: ${outputPath}`)
  console.log('The file contains the admin password. Apply it once, then delete it.')
  console.log('Secret values were not printed to stdout.')
} catch (error) {
  console.error(error.message)
  console.error(usage)
  process.exit(1)
}
