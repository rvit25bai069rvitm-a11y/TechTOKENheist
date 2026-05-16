import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  normalizeEnvValue,
  parseEnvFile,
  redactCliOutput,
  validateSupabaseProductionEnv,
} from './vercel-env-utils.js'

const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'

const buildLiveDeploymentEnv = () => {
  if (normalizeEnvValue(process.env.EXPECTED_SUPABASE_URL)) {
    return process.env
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'tth-vercel-live-status-'))
  const tempEnvPath = join(tempDir, '.env.production.local')

  try {
    const pull = spawnSync('vercel', ['env', 'pull', tempEnvPath, '--environment=production', '--yes'], {
      encoding: 'utf8',
      shell: isWindows,
    })

    if (pull.error || pull.status !== 0) return process.env

    const values = parseEnvFile(readFileSync(tempEnvPath, 'utf8'))
    const { ok } = validateSupabaseProductionEnv(values)
    if (!ok) return process.env

    return {
      ...process.env,
      EXPECTED_SUPABASE_URL: values.VITE_SUPABASE_URL,
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const checks = [
  {
    name: 'Vercel production env',
    command: npmCommand,
    args: ['run', 'verify:vercel-env'],
  },
  {
    name: 'live Supabase schema/RLS',
    command: npmCommand,
    args: ['run', 'verify:supabase'],
  },
  {
    name: 'live production deployment',
    command: npmCommand,
    args: ['run', 'verify:production-deploy'],
    buildEnv: buildLiveDeploymentEnv,
  },
]

const validArgs = new Set(['--help', '-h', '--list'])
const unknownArgs = process.argv.slice(2).filter((arg) => !validArgs.has(arg))
if (unknownArgs.length > 0) {
  console.error(`Unknown argument: ${unknownArgs.join(', ')}`)
  console.error('Usage: node scripts/verify-live-status.js [--list]')
  process.exit(1)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/verify-live-status.js [--list]')
  console.log('')
  console.log('Runs the non-mutating live production readiness checks.')
  console.log('This does not build, deploy, or write Vercel/Supabase state.')
  process.exit(0)
}

if (process.argv.includes('--list')) {
  checks.forEach((check, index) => {
    console.log(`${index + 1}. ${check.name}: ${[check.command, ...check.args].join(' ')}`)
  })
  process.exit(0)
}

const failures = []

const writeChildOutput = (result) => {
  if (result.stdout) process.stdout.write(redactCliOutput(result.stdout))
  if (result.stderr) process.stderr.write(redactCliOutput(result.stderr))
}

for (const check of checks) {
  console.log(`\n=== ${check.name} ===`)
  const env = check.buildEnv ? check.buildEnv() : process.env
  const result = spawnSync(check.command, check.args, {
    encoding: 'utf8',
    env,
    shell: isWindows,
  })

  writeChildOutput(result)

  if (result.error) {
    failures.push(`${check.name} could not start: ${result.error.message}`)
    continue
  }

  if (result.status === null) {
    failures.push(`${check.name} terminated without an exit code${result.signal ? ` (${result.signal})` : ''}`)
    continue
  }

  if (result.status !== 0) {
    failures.push(`${check.name} failed with exit code ${result.status}`)
  }
}

if (failures.length > 0) {
  console.error('\nLive event status: NOT READY')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('\nLive event status: READY')
