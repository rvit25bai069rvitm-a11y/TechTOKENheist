import { Buffer } from 'node:buffer'

export const REQUIRED_SUPABASE_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
]

export const REQUIRED_ADMIN_VERIFY_ENV = [
  'VERIFY_SUPABASE_ADMIN_USERNAME',
  'VERIFY_SUPABASE_ADMIN_PASSWORD',
]

export const normalizeEnvValue = (value) => String(value || '').trim().replace(/^["']|["']$/g, '').trim()

export const parseEnvFile = (contents) => Object.fromEntries(
  String(contents || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [
        line.slice(0, separator).trim(),
        normalizeEnvValue(line.slice(separator + 1)),
      ]
    })
)

export const isValidSupabaseUrl = (value) => {
  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.toLowerCase()
    const projectRef = hostname.replace(/\.supabase\.co$/, '')
    const placeholderRefs = new Set([
      'project-ref',
      'your-project',
      'your-project-ref',
      'example',
    ])

    return parsed.protocol === 'https:' &&
      hostname.endsWith('.supabase.co') &&
      !placeholderRefs.has(projectRef)
  } catch {
    return false
  }
}

const parseJwtPayload = (value) => {
  const [, payload] = String(value || '').split('.')
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export const isValidPublishableKey = (value) => {
  const trimmed = normalizeEnvValue(value)
  if (!trimmed || trimmed === 'your-publishable-key') return false
  if (/^sb_secret_/i.test(trimmed)) return false
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed.length >= 20

  const jwtPayload = parseJwtPayload(trimmed)
  if (jwtPayload) return jwtPayload.role === 'anon'

  return false
}

export const redactCliOutput = (value) => String(value || '')
  .replace(/https:\/\/[a-z0-9-]+\.supabase\.co/gi, 'https://<ref>.supabase.co')
  .replace(/sb_publishable_[A-Za-z0-9_-]+/g, 'sb_publishable_<redacted>')
  .replace(/sb_secret_[A-Za-z0-9_-]+/g, 'sb_secret_<redacted>')
  .replace(/eyJ[A-Za-z0-9_.-]+/g, '<jwt-like-value>')

export const formatVercelProductionEnvFix = () => [
  'Fix:',
  '1. Copy .env.production.local.example to .env.production.local and fill in the real event Supabase URL, anon key, DB URL, and strong admin credential.',
  '2. Run: npm run supabase:apply-policies -- --from .env.production.local --apply',
  '3. Run: npm run vercel:set-production-env -- --from .env.production.local --require-admin-verifier --apply',
  '4. Re-run: npm run deploy:production',
].join('\n')

export const validateSupabaseProductionEnv = (values) => {
  const env = values || {}
  const supabaseUrl = normalizeEnvValue(env.VITE_SUPABASE_URL)
  const publishableKey = normalizeEnvValue(env.VITE_SUPABASE_ANON_KEY)
  const missing = REQUIRED_SUPABASE_ENV.filter((key) => !Object.hasOwn(env, key))
  const blank = REQUIRED_SUPABASE_ENV.filter((key) => Object.hasOwn(env, key) && !normalizeEnvValue(env[key]))
  const invalid = []

  if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
    invalid.push('VITE_SUPABASE_URL')
  }
  if (publishableKey && !isValidPublishableKey(publishableKey)) {
    invalid.push('VITE_SUPABASE_ANON_KEY')
  }

  return {
    ok: missing.length === 0 && blank.length === 0 && invalid.length === 0,
    missing,
    blank,
    invalid,
  }
}

export const validateAdminVerifierEnv = (values) => {
  const env = values || {}
  const missing = REQUIRED_ADMIN_VERIFY_ENV.filter((key) => !normalizeEnvValue(env[key]))
  const invalid = []
  const username = normalizeEnvValue(env.VERIFY_SUPABASE_ADMIN_USERNAME)
  const password = normalizeEnvValue(env.VERIFY_SUPABASE_ADMIN_PASSWORD)

  if (username && (username.length > 80 || username.includes(':'))) {
    invalid.push('VERIFY_SUPABASE_ADMIN_USERNAME')
  }

  if (
    password &&
    (
      password.length < 12 ||
      /^(change-this-password|replace-with-strong-event-password|your-password|example-password|iamadmin|admin|password)$/i.test(password)
    )
  ) {
    invalid.push('VERIFY_SUPABASE_ADMIN_PASSWORD')
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  }
}
