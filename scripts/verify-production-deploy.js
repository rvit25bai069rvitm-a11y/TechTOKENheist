import { Buffer } from 'node:buffer'
import process from 'node:process'

const DEFAULT_PRODUCTION_URL = 'https://tech-token-heist-one.vercel.app'
const EVENT_BUILD_MARKER = 'event-hardening-2026-05-16'
const FETCH_TIMEOUT_MS = 15_000
const PRODUCTION_ENTRYPOINTS = [
  '/',
  '/index.html',
  '/login',
  '/login.html',
  '/lobby',
  '/lobby.html',
  '/arena',
  '/arena.html',
  '/battle',
  '/battle.html',
  '/rulebook',
  '/rulebook.html',
  '/about',
  '/about.html',
  '/devs',
  '/devs.html',
  '/admin',
  '/admin.html',
]
const SECURITY_HEADER_CHECKS = [
  { key: 'x-content-type-options', expectedPattern: /^nosniff$/i, description: 'nosniff' },
  { key: 'x-frame-options', expectedPattern: /^DENY$/i, description: 'DENY' },
  {
    key: 'referrer-policy',
    expectedPattern: /^strict-origin-when-cross-origin$/i,
    description: 'strict-origin-when-cross-origin',
  },
  {
    key: 'permissions-policy',
    expectedPattern: /camera=\(\), microphone=\(\), geolocation=\(\)/,
    description: 'camera/microphone/geolocation disabled',
  },
  { key: 'content-security-policy', expectedPattern: /default-src 'self'/, description: "default-src 'self'" },
  {
    key: 'content-security-policy',
    expectedPattern: /connect-src[^;]*https:\/\/\*\.supabase\.co/,
    description: 'Supabase connect-src',
  },
  {
    key: 'content-security-policy',
    expectedPattern: /connect-src[^;]*wss:\/\/\*\.supabase\.co/,
    description: 'Supabase realtime connect-src',
  },
  {
    key: 'content-security-policy',
    expectedPattern: /object-src 'none'/,
    description: "object-src 'none'",
  },
  {
    key: 'content-security-policy',
    expectedPattern: /frame-ancestors 'none'/,
    description: "frame-ancestors 'none'",
  },
]

const ASSET_HEADER_CHECKS = [
  {
    key: 'cache-control',
    expectedPattern: /public,\s*max-age=31536000,\s*immutable/i,
    description: 'immutable one-year asset caching',
  },
]

const normalizeUrl = (value) => {
  const raw = String(value || DEFAULT_PRODUCTION_URL).trim()
  if (!raw) return DEFAULT_PRODUCTION_URL
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

const normalizeSupabaseUrl = (value) => {
  const raw = String(value || '').trim().replace(/^["']|["']$/g, '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    return parsed.origin.toLowerCase()
  } catch {
    return ''
  }
}

const productionUrl = normalizeUrl(process.env.PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)
const rawExpectedSupabaseUrl = process.env.EXPECTED_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const expectedSupabaseUrl = normalizeSupabaseUrl(rawExpectedSupabaseUrl)
const baseUrl = new URL(productionUrl)
const failures = []

const fail = (message) => {
  failures.push(message)
}

const fetchText = async (pathOrUrl) => {
  const url = new URL(pathOrUrl, baseUrl)
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
    })

    const text = await response.text()
    return { ok: true, response, text, url }
  } catch (error) {
    return {
      ok: false,
      error,
      text: '',
      url,
    }
  }
}

const findScriptSources = (html) => [...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi)]
  .map((match) => match[1])

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

const findLeakedSupabaseClientSecrets = (text) => {
  const leaks = []

  if (/sb_secret_[A-Za-z0-9_-]+/i.test(text)) {
    leaks.push('Production bundle contains an sb_secret_ Supabase secret key.')
  }

  const jwtMatches = [...text.matchAll(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)]
    .map((match) => match[0])
  const hasServiceRoleJwt = jwtMatches.some((token) => parseJwtPayload(token)?.role === 'service_role')
  if (hasServiceRoleJwt) {
    leaks.push('Production bundle contains a Supabase service-role JWT.')
  }

  return leaks
}

const checkHeader = (headers, { key, expectedPattern, description }, path) => {
  const value = headers.get(key)
  if (!value || !expectedPattern.test(value)) {
    fail(`${path} is missing or has invalid ${key} header (${description}).`)
  }
}

try {
  const scriptSources = new Set()

  if (String(rawExpectedSupabaseUrl || '').trim() && !expectedSupabaseUrl) {
    fail('EXPECTED_SUPABASE_URL or VITE_SUPABASE_URL is not a valid URL.')
  }

  for (const path of PRODUCTION_ENTRYPOINTS) {
    const { ok, response, text: html, error, url } = await fetchText(path)
    if (!ok) {
      fail(`${path} could not be fetched from production: ${error?.message || error || url.href}.`)
      continue
    }

    if (!response.ok) {
      fail(`${path} returned HTTP ${response.status}.`)
    }

    if (!html.includes(`content="${EVENT_BUILD_MARKER}"`)) {
      fail(`${path} HTML is missing event build marker ${EVENT_BUILD_MARKER}. The live site may be stale.`)
    }

    for (const headerCheck of SECURITY_HEADER_CHECKS) {
      checkHeader(response.headers, headerCheck, path)
    }

    const pageScriptSources = findScriptSources(html)
    if (pageScriptSources.length === 0) {
      fail(`${path} HTML did not reference any JavaScript bundle.`)
    }

    pageScriptSources.forEach((source) => scriptSources.add(source))
  }

  const scriptBodies = []
  for (const source of scriptSources) {
    const { ok, response: scriptResponse, text: scriptText, url, error } = await fetchText(source)
    if (!ok) {
      fail(`Production JavaScript bundle could not be fetched: ${url.pathname} (${error?.message || error || 'fetch failed'}).`)
      continue
    }
    if (!scriptResponse.ok) {
      fail(`Production JavaScript bundle failed to load: ${url.pathname} returned HTTP ${scriptResponse.status}.`)
      continue
    }
    for (const headerCheck of ASSET_HEADER_CHECKS) {
      checkHeader(scriptResponse.headers, headerCheck, url.pathname)
    }
    scriptBodies.push(scriptText)
  }

  const joinedScripts = scriptBodies.join('\n')
  const bundledSupabaseUrls = [...joinedScripts.matchAll(/https:\/\/[a-z0-9-]+\.supabase\.co/gi)]
    .map((match) => match[0].toLowerCase())
  if (bundledSupabaseUrls.length === 0) {
    fail('Production bundle does not contain a concrete Supabase project URL.')
  }

  if (expectedSupabaseUrl && bundledSupabaseUrls.length > 0 && !bundledSupabaseUrls.includes(expectedSupabaseUrl)) {
    fail('Production bundle Supabase URL does not match EXPECTED_SUPABASE_URL or VITE_SUPABASE_URL.')
  }

  if (/your-project-ref\.supabase\.co/i.test(joinedScripts)) {
    fail('Production bundle still contains the placeholder Supabase project URL.')
  }

  findLeakedSupabaseClientSecrets(joinedScripts).forEach(fail)

  if (failures.length > 0) {
    console.error(`Production deployment verification failed for ${baseUrl.origin}:`)
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exit(1)
  }

  console.log(`Production deployment verified for ${baseUrl.origin}.`)
  console.log(`Build marker: ${EVENT_BUILD_MARKER}`)
  console.log(`HTML entrypoints checked: ${PRODUCTION_ENTRYPOINTS.length}`)
  console.log(`JavaScript bundles checked: ${scriptSources.size}`)
} catch (error) {
  console.error(`Production deployment verification crashed for ${baseUrl.origin}:`)
  console.error(error)
  process.exit(1)
}
