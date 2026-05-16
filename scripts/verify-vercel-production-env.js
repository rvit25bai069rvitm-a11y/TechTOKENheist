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

const verifyProductionEnv = () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'tth-vercel-env-'))
  const tempEnvPath = join(tempDir, '.env.production.local')

  try {
    const pull = spawnSync('vercel', ['env', 'pull', tempEnvPath, '--environment=production', '--yes'], {
      encoding: 'utf8',
      shell: isWindows,
    })

    if (pull.error) {
      console.error('Vercel production env verification failed: vercel env pull could not start.')
      console.error(pull.error.message)
      return 1
    }

    if (pull.status !== 0) {
      console.error('Vercel production env verification failed: vercel env pull did not complete.')
      if (pull.stdout) console.error(redactCliOutput(pull.stdout.trim()))
      if (pull.stderr) console.error(redactCliOutput(pull.stderr.trim()))
      return pull.status || 1
    }

    const values = parseEnvFile(readFileSync(tempEnvPath, 'utf8'))
    const { ok, missing, blank, invalid } = validateSupabaseProductionEnv(values)
    const adminVerifier = validateAdminVerifierEnv(values)

    if (!ok || !adminVerifier.ok) {
      console.error('Vercel production env verification failed.')
      if (missing.length > 0) console.error(`Missing required vars: ${missing.join(', ')}`)
      if (blank.length > 0) console.error(`Blank required vars: ${blank.join(', ')}`)
      if (invalid.length > 0) console.error(`Invalid required vars: ${invalid.join(', ')}`)
      if (adminVerifier.missing.length > 0) {
        console.error(`Missing required admin verification vars: ${adminVerifier.missing.join(', ')}`)
      }
      if (adminVerifier.invalid.length > 0) {
        console.error(`Invalid admin verification vars: ${adminVerifier.invalid.join(', ')}`)
      }
      console.error('Fix the Vercel Production environment values before deploying the event build.')
      console.error(formatVercelProductionEnvFix())
      return 1
    }

    console.log('Vercel production env verification passed.')
    return 0
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const exitCode = verifyProductionEnv()
if (exitCode !== 0) {
  process.exit(exitCode)
}
