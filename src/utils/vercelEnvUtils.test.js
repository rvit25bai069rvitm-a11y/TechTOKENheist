import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'

import {
  formatVercelProductionEnvFix,
  isValidPublishableKey,
  parseEnvFile,
  redactCliOutput,
  validateAdminVerifierEnv,
  validateSupabaseProductionEnv,
} from '../../scripts/vercel-env-utils.js'

const jwtWithRole = (role) => {
  const encode = (value) => Buffer
    .from(JSON.stringify(value))
    .toString('base64url')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`
}

test('Vercel env parser normalizes comments, quotes, and blank values', () => {
  assert.deepEqual(parseEnvFile(`
    # ignored
    VITE_SUPABASE_URL="https://abcdefghijklmnopqrst.supabase.co"
    VITE_SUPABASE_ANON_KEY='sb_publishable_1234567890abcdef'
    EMPTY_VALUE=" "
    VALUE_WITH_EQUALS=left=right
  `), {
    VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_1234567890abcdef',
    EMPTY_VALUE: '',
    VALUE_WITH_EQUALS: 'left=right',
  })
})

test('Vercel env fix instructions give the safe production repair path', () => {
  const instructions = formatVercelProductionEnvFix()

  assert.match(instructions, /\.env\.production\.local\.example/)
  assert.match(instructions, /\.env\.production\.local/)
  assert.match(instructions, /supabase:apply-policies -- --from \.env\.production\.local --apply/)
  assert.match(instructions, /vercel:set-production-env -- --from \.env\.production\.local --require-admin-verifier --apply/)
  assert.match(instructions, /deploy:production/)
  assert.doesNotMatch(instructions, /VITE_SUPABASE_ANON_KEY=/)
  assert.doesNotMatch(instructions, /sb_secret_/)
})

test('Supabase key validator accepts anon keys and rejects service-role secrets', () => {
  assert.equal(isValidPublishableKey('sb_publishable_1234567890abcdef'), true)
  assert.equal(isValidPublishableKey(jwtWithRole('anon')), true)
  assert.equal(isValidPublishableKey('sb_secret_1234567890abcdef'), false)
  assert.equal(isValidPublishableKey(jwtWithRole('service_role')), false)
  assert.equal(isValidPublishableKey('a-long-but-unknown-secret-looking-value'), false)
})

test('Vercel env validator separates missing, blank, and invalid Supabase values', () => {
  assert.deepEqual(validateSupabaseProductionEnv({}), {
    ok: false,
    missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    blank: [],
    invalid: [],
  })

  assert.deepEqual(validateSupabaseProductionEnv({
    VITE_SUPABASE_URL: '""',
    VITE_SUPABASE_ANON_KEY: '  ',
  }), {
    ok: false,
    missing: [],
    blank: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    invalid: [],
  })

  assert.deepEqual(validateSupabaseProductionEnv({
    VITE_SUPABASE_URL: 'http://project-ref.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'your-publishable-key',
  }), {
    ok: false,
    missing: [],
    blank: [],
    invalid: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  })

  assert.deepEqual(validateSupabaseProductionEnv({
    VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_publishable_1234567890abcdef',
  }), {
    ok: false,
    missing: [],
    blank: [],
    invalid: ['VITE_SUPABASE_URL'],
  })

  assert.deepEqual(validateSupabaseProductionEnv({
    VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    VITE_SUPABASE_ANON_KEY: jwtWithRole('service_role'),
  }), {
    ok: false,
    missing: [],
    blank: [],
    invalid: ['VITE_SUPABASE_ANON_KEY'],
  })

  assert.deepEqual(validateSupabaseProductionEnv({
    VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    VITE_SUPABASE_ANON_KEY: jwtWithRole('anon'),
  }), {
    ok: true,
    missing: [],
    blank: [],
    invalid: [],
  })
})

test('admin verifier env rejects placeholders before production writes', () => {
  assert.deepEqual(validateAdminVerifierEnv({}), {
    ok: false,
    missing: ['VERIFY_SUPABASE_ADMIN_USERNAME', 'VERIFY_SUPABASE_ADMIN_PASSWORD'],
    invalid: [],
  })

  assert.deepEqual(validateAdminVerifierEnv({
    VERIFY_SUPABASE_ADMIN_USERNAME: 'admin',
    VERIFY_SUPABASE_ADMIN_PASSWORD: 'change-this-password',
  }), {
    ok: false,
    missing: [],
    invalid: ['VERIFY_SUPABASE_ADMIN_PASSWORD'],
  })

  assert.deepEqual(validateAdminVerifierEnv({
    VERIFY_SUPABASE_ADMIN_USERNAME: 'admin-professor',
    VERIFY_SUPABASE_ADMIN_PASSWORD: 'iamadmin',
  }), {
    ok: false,
    missing: [],
    invalid: ['VERIFY_SUPABASE_ADMIN_PASSWORD'],
  })

  assert.deepEqual(validateAdminVerifierEnv({
    VERIFY_SUPABASE_ADMIN_USERNAME: 'admin:bad',
    VERIFY_SUPABASE_ADMIN_PASSWORD: 'replace-with-strong-event-password',
  }), {
    ok: false,
    missing: [],
    invalid: ['VERIFY_SUPABASE_ADMIN_USERNAME', 'VERIFY_SUPABASE_ADMIN_PASSWORD'],
  })

  assert.deepEqual(validateAdminVerifierEnv({
    VERIFY_SUPABASE_ADMIN_USERNAME: 'admin',
    VERIFY_SUPABASE_ADMIN_PASSWORD: 'StrongEventPassword123!',
  }), {
    ok: true,
    missing: [],
    invalid: [],
  })
})

test('Vercel env redaction hides public config values in CLI output', () => {
  const redacted = redactCliOutput([
    'URL=https://abcdefghijklmnopqrst.supabase.co',
    'KEY=sb_publishable_1234567890abcdef',
    'SECRET=sb_secret_1234567890abcdef',
    'TOKEN=eyJhbGciOiJIUzI1NiJ9.payload.signature',
  ].join('\n'))

  assert.match(redacted, /https:\/\/<ref>\.supabase\.co/)
  assert.match(redacted, /sb_publishable_<redacted>/)
  assert.match(redacted, /sb_secret_<redacted>/)
  assert.match(redacted, /<jwt-like-value>/)
  assert.doesNotMatch(redacted, /abcdefghijklmnopqrst/)
  assert.doesNotMatch(redacted, /1234567890abcdef/)
  assert.doesNotMatch(redacted, /eyJhbGci/)
})
