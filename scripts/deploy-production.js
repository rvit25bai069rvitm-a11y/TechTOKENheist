import { spawn } from 'node:child_process'
import process from 'node:process'
import { redactCliOutput } from './vercel-env-utils.js'

const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'

const gates = [
  {
    name: 'lockfile install gate',
    command: npmCommand,
    args: ['run', 'verify:install'],
  },
  {
    name: 'local app gate',
    command: npmCommand,
    args: ['run', 'verify'],
  },
  {
    name: 'local browser smoke gate',
    command: npmCommand,
    args: ['run', 'verify:browser'],
  },
  {
    name: 'configured browser smoke gate',
    command: npmCommand,
    args: ['run', 'verify:browser:configured'],
  },
  {
    name: 'admin workflow smoke gate',
    command: npmCommand,
    args: ['run', 'verify:admin-workflow'],
  },
  {
    name: 'local Supabase SQL/RLS gate',
    command: npmCommand,
    args: ['run', 'verify:supabase:local-sql'],
  },
  {
    name: 'Vercel production env gate',
    command: npmCommand,
    args: ['run', 'verify:vercel-env'],
  },
  {
    name: 'Vercel production build gate',
    command: 'vercel',
    args: ['build', '--prod', '--yes'],
  },
  {
    name: 'live Supabase mutation gate',
    command: 'node',
    args: ['scripts/with-vercel-production-env.js', '--require-supabase-admin', npmCommand, 'run', 'verify:supabase:mutations'],
  },
  {
    name: 'production deploy',
    command: 'vercel',
    args: ['deploy', '--prebuilt', '--prod', '--yes'],
  },
  {
    name: 'live production deployment gate',
    command: 'node',
    args: ['scripts/with-vercel-production-env.js', npmCommand, 'run', 'verify:production-deploy'],
  },
]

const validArgs = new Set(['--help', '-h', '--list'])
const unknownArgs = process.argv.slice(2).filter((arg) => !validArgs.has(arg))
if (unknownArgs.length > 0) {
  console.error(`Unknown argument: ${unknownArgs.join(', ')}`)
  console.error('Usage: node scripts/deploy-production.js [--list]')
  process.exit(1)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/deploy-production.js [--list]')
  console.log('')
  console.log('Runs every production gate, deploys the prebuilt Vercel output, then verifies the live site.')
  console.log('The deploy stops at the first failed gate.')
  process.exit(0)
}

if (process.argv.includes('--list')) {
  gates.forEach((gate, index) => {
    console.log(`${index + 1}. ${gate.name}: ${[gate.command, ...gate.args].join(' ')}`)
  })
  process.exit(0)
}

const createRedactedStreamWriter = (target) => {
  let pending = ''
  const carryLength = 4096

  return {
    write(chunk) {
      pending += chunk.toString()
      if (pending.length <= carryLength) return

      const ready = pending.slice(0, -carryLength)
      pending = pending.slice(-carryLength)
      target.write(redactCliOutput(ready))
    },
    flush() {
      if (pending) {
        target.write(redactCliOutput(pending))
        pending = ''
      }
    },
  }
}

const runGate = (gate) => new Promise((resolve, reject) => {
  const child = spawn(gate.command, gate.args, {
    shell: isWindows,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  const stdout = createRedactedStreamWriter(process.stdout)
  const stderr = createRedactedStreamWriter(process.stderr)

  child.stdout.on('data', (chunk) => stdout.write(chunk))
  child.stderr.on('data', (chunk) => stderr.write(chunk))
  child.on('error', (error) => {
    stdout.flush()
    stderr.flush()
    reject(error)
  })
  child.on('close', (code, signal) => {
    stdout.flush()
    stderr.flush()
    resolve({ code, signal })
  })
})

for (const gate of gates) {
  console.log(`\n=== ${gate.name} ===`)

  let result
  try {
    result = await runGate(gate)
  } catch (error) {
    console.error(`Production deploy stopped: ${gate.name} could not start.`)
    console.error(error.message)
    process.exit(1)
  }

  if (result.code === null) {
    console.error(`Production deploy stopped: ${gate.name} terminated without an exit code${result.signal ? ` (${result.signal})` : ''}.`)
    process.exit(1)
  }

  if (result.code !== 0) {
    console.error(`Production deploy stopped: ${gate.name} failed with exit code ${result.code}.`)
    process.exit(result.code || 1)
  }
}

console.log('\nProduction deploy passed all configured gates.')
