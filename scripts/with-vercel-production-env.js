import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  formatVercelProductionEnvFix,
  parseEnvFile,
  redactCliOutput,
  validateAdminVerifierEnv,
  validateSupabaseProductionEnv,
} from './vercel-env-utils.js'

const isWindows = process.platform === 'win32'
const childOutputMaxBuffer = 20 * 1024 * 1024

const validateEnv = (values, { requireSupabaseAdmin } = {}) => {
  const { ok, missing, blank, invalid } = validateSupabaseProductionEnv(values)

  if (!ok) {
    console.error('Cannot run command with Vercel Production env.')
    if (missing.length > 0) console.error(`Missing required vars: ${missing.join(', ')}`)
    if (blank.length > 0) console.error(`Blank required vars: ${blank.join(', ')}`)
    if (invalid.length > 0) console.error(`Invalid required vars: ${invalid.join(', ')}`)
    console.error(formatVercelProductionEnvFix())
    return false
  }

  if (requireSupabaseAdmin) {
    const adminVerifier = validateAdminVerifierEnv(values)

    if (!adminVerifier.ok) {
      console.error('Cannot run live Supabase mutation gate.')
      if (adminVerifier.missing.length > 0) {
        console.error(`Missing required admin verification vars: ${adminVerifier.missing.join(', ')}`)
      }
      if (adminVerifier.invalid.length > 0) {
        console.error(`Invalid admin verification vars: ${adminVerifier.invalid.join(', ')}`)
      }
      console.error('Set them in the shell or the linked Vercel Production environment before running verify:release.')
      console.error(formatVercelProductionEnvFix())
      return false
    }
  }

  return true
}

const writeRedactedOutput = (result) => {
  if (result.stdout) process.stdout.write(redactCliOutput(result.stdout))
  if (result.stderr) process.stderr.write(redactCliOutput(result.stderr))
}

const rawArgs = process.argv.slice(2)
const requireSupabaseAdmin = rawArgs[0] === '--require-supabase-admin'
const [command, ...args] = requireSupabaseAdmin ? rawArgs.slice(1) : rawArgs
if (!command) {
  console.error('Usage: node scripts/with-vercel-production-env.js [--require-supabase-admin] <command> [...args]')
  process.exit(1)
}

const runWithVercelProductionEnv = () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'tth-vercel-env-run-'))
  const tempEnvPath = join(tempDir, '.env.production.local')

  try {
    const pull = spawnSync('vercel', ['env', 'pull', tempEnvPath, '--environment=production', '--yes'], {
      encoding: 'utf8',
      shell: isWindows,
    })

    if (pull.error) {
      console.error('Could not pull Vercel Production env.')
      console.error(pull.error.message)
      return 1
    }

    if (pull.status !== 0) {
      console.error('Could not pull Vercel Production env.')
      if (pull.stdout) console.error(redactCliOutput(pull.stdout.trim()))
      if (pull.stderr) console.error(redactCliOutput(pull.stderr.trim()))
      return pull.status || 1
    }

    const values = parseEnvFile(readFileSync(tempEnvPath, 'utf8'))
    const commandEnv = {
      ...process.env,
      ...values,
      EXPECTED_SUPABASE_URL: process.env.EXPECTED_SUPABASE_URL || values.VITE_SUPABASE_URL,
    }
    if (!validateEnv(commandEnv, { requireSupabaseAdmin })) return 1

    const result = spawnSync(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: childOutputMaxBuffer,
      shell: isWindows,
      env: commandEnv,
    })
    writeRedactedOutput(result)

    if (result.error) {
      console.error(`Command could not start with Vercel Production env: ${command}`)
      console.error(result.error.message)
      return 1
    }

    if (result.status === null) {
      console.error(`Command terminated without an exit code${result.signal ? ` (${result.signal})` : ''}.`)
      return 1
    }

    return result.status
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const exitCode = runWithVercelProductionEnv()
if (exitCode !== 0) {
  process.exit(exitCode)
}
