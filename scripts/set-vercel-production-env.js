import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import {
  REQUIRED_ADMIN_VERIFY_ENV,
  normalizeEnvValue,
  parseEnvFile,
  formatVercelProductionEnvFix,
  redactCliOutput,
  validateAdminVerifierEnv,
  validateSupabaseProductionEnv,
} from './vercel-env-utils.js'

const isWindows = process.platform === 'win32'
const childOutputMaxBuffer = 20 * 1024 * 1024
const VERCEL_PRODUCTION_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  ...REQUIRED_ADMIN_VERIFY_ENV,
]

const usage = `Usage:
  node scripts/set-vercel-production-env.js --from .env.production.local --apply

Options:
  --from <path>              Read values from an env file. Process env overrides file values.
  --apply                    Write validated values to Vercel Production. Requires admin verifier values.
  --require-admin-verifier   Also require admin verifier values during dry-run validation.
  --skip-supabase-health     Stage Vercel env without checking live Supabase first.
                             Deployment still requires the live Supabase gates.

Without --apply, this validates input only and prints no secret values.`

const parseArgs = (argv) => {
  const options = {
    apply: false,
    from: null,
    requireAdminVerifier: false,
    skipSupabaseHealth: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--skip-supabase-health') {
      options.skipSupabaseHealth = true
    } else if (arg === '--require-admin-verifier') {
      options.requireAdminVerifier = true
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
      console.error(`Env file not found: ${absolutePath}`)
      process.exit(1)
    }
    Object.assign(fileValues, parseEnvFile(readFileSync(absolutePath, 'utf8')))
  }

  const processValues = Object.fromEntries(
    VERCEL_PRODUCTION_ENV
      .map((key) => [key, normalizeEnvValue(process.env[key])])
      .filter(([, value]) => Boolean(value))
  )

  return {
    ...fileValues,
    ...processValues,
  }
}

const validateSourceValues = (values, { requireAdminVerifier }) => {
  const { ok, missing, blank, invalid } = validateSupabaseProductionEnv(values)
  const adminVerifier = validateAdminVerifierEnv(values)

  if (!ok) {
    console.error('Cannot configure Vercel Production Supabase env.')
    if (missing.length > 0) console.error(`Missing required vars: ${missing.join(', ')}`)
    if (blank.length > 0) console.error(`Blank required vars: ${blank.join(', ')}`)
    if (invalid.length > 0) console.error(`Invalid required vars: ${invalid.join(', ')}`)
    console.error(formatVercelProductionEnvFix())
    process.exit(1)
  }

  if (requireAdminVerifier && !adminVerifier.ok) {
    console.error('Cannot configure complete release verification env.')
    if (adminVerifier.missing.length > 0) {
      console.error(`Missing required admin verification vars: ${adminVerifier.missing.join(', ')}`)
    }
    if (adminVerifier.invalid.length > 0) {
      console.error(`Invalid admin verification vars: ${adminVerifier.invalid.join(', ')}`)
    }
    process.exit(1)
  }

  return { adminVerifier }
}

const verifySupabaseProjectHealth = (values) => {
  const result = spawnSync(process.execPath, ['scratch/test_supabase.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: normalizeEnvValue(values.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY: normalizeEnvValue(values.VITE_SUPABASE_ANON_KEY),
    },
    maxBuffer: childOutputMaxBuffer,
    shell: false,
  })

  if (result.error) {
    console.error('Supabase project health check failed.')
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status === null) {
    console.error(`Supabase project health check failed${result.signal ? ` (${result.signal})` : ''}.`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error('Supabase project health check failed.')
    if (result.stdout) console.error(redactCliOutput(result.stdout.trim()))
    if (result.stderr) console.error(redactCliOutput(result.stderr.trim()))
    console.error('Run server/supabase_policies.sql against the production Supabase project, then re-run this command.')
    process.exit(result.status || 1)
  }
}

const setVercelProductionValue = (key, value) => {
  const result = spawnSync('vercel', ['env', 'add', key, 'production', '--force'], {
    input: value,
    encoding: 'utf8',
    shell: isWindows,
  })

  if (result.error) {
    console.error(`Could not set ${key} in Vercel Production.`)
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`Could not set ${key} in Vercel Production.`)
    if (result.stdout) console.error(redactCliOutput(result.stdout.trim()))
    if (result.stderr) console.error(redactCliOutput(result.stderr.trim()))
    process.exit(result.status || 1)
  }
}

const verifyPulledProductionEnv = ({ requireAdminVerifier } = {}) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'tth-vercel-prod-env-'))
  const tempEnvPath = join(tempDir, '.env.production.local')

  try {
    const pull = spawnSync('vercel', ['env', 'pull', tempEnvPath, '--environment=production', '--yes'], {
      encoding: 'utf8',
      shell: isWindows,
    })

    if (pull.error) {
      console.error('Could not verify Vercel Production env after update.')
      console.error(pull.error.message)
      return 1
    }

    if (pull.status !== 0) {
      console.error('Could not verify Vercel Production env after update.')
      if (pull.stdout) console.error(redactCliOutput(pull.stdout.trim()))
      if (pull.stderr) console.error(redactCliOutput(pull.stderr.trim()))
      return pull.status || 1
    }

    const values = parseEnvFile(readFileSync(tempEnvPath, 'utf8'))
    const { ok, missing, blank, invalid } = validateSupabaseProductionEnv(values)
    if (!ok) {
      console.error('Vercel Production env was updated but still failed validation.')
      if (missing.length > 0) console.error(`Missing required vars: ${missing.join(', ')}`)
      if (blank.length > 0) console.error(`Blank required vars: ${blank.join(', ')}`)
      if (invalid.length > 0) console.error(`Invalid required vars: ${invalid.join(', ')}`)
      return 1
    }

    if (requireAdminVerifier) {
      const adminVerifier = validateAdminVerifierEnv(values)
      if (!adminVerifier.ok) {
        console.error('Vercel Production env was updated but admin verification vars were not confirmed.')
        if (adminVerifier.missing.length > 0) {
          console.error(`Missing required admin verification vars: ${adminVerifier.missing.join(', ')}`)
        }
        if (adminVerifier.invalid.length > 0) {
          console.error(`Invalid admin verification vars: ${adminVerifier.invalid.join(', ')}`)
        }
        return 1
      }
    }

    return 0
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const options = parseArgs(process.argv.slice(2))
const sourceValues = loadSourceValues(options.from)
const { adminVerifier } = validateSourceValues(sourceValues, {
  requireAdminVerifier: options.requireAdminVerifier,
})

const valuesToApply = VERCEL_PRODUCTION_ENV
  .map((key) => [key, normalizeEnvValue(sourceValues[key])])
  .filter(([, value]) => Boolean(value))

if (!options.apply) {
  console.log('Vercel Production Supabase values are valid.')
  if (!adminVerifier.ok) {
    const adminVerifierIssues = [...adminVerifier.missing, ...adminVerifier.invalid]
    console.log(`Admin verification vars not ready: ${adminVerifierIssues.join(', ')}`)
  }
  console.log('Dry run only. Re-run with --apply to update Vercel Production.')
  process.exit(0)
}

if (options.apply && !adminVerifier.ok) {
  console.error('Cannot update Vercel Production without admin verification vars.')
  if (adminVerifier.missing.length > 0) {
    console.error(`Missing required admin verification vars: ${adminVerifier.missing.join(', ')}`)
  }
  if (adminVerifier.invalid.length > 0) {
    console.error(`Invalid admin verification vars: ${adminVerifier.invalid.join(', ')}`)
  }
  process.exit(1)
}

if (options.skipSupabaseHealth) {
  console.warn('Skipping live Supabase health check for Vercel env staging.')
  console.warn('npm run deploy:production still blocks on the live Supabase mutation gate before deploying.')
} else {
  verifySupabaseProjectHealth(sourceValues)
}

for (const [key, value] of valuesToApply) {
  setVercelProductionValue(key, value)
}

const verifyExitCode = verifyPulledProductionEnv({ requireAdminVerifier: true })
if (verifyExitCode !== 0) {
  process.exit(verifyExitCode)
}
console.log('Vercel Production env updated and verified.')
