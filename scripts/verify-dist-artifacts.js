import { Buffer } from 'node:buffer'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = resolve(rootDir, 'dist')
const EVENT_BUILD_MARKER = 'event-hardening-2026-05-16'
const HTML_ENTRYPOINTS = [
  'index.html',
  'login.html',
  'lobby.html',
  'arena.html',
  'battle.html',
  'rulebook.html',
  'about.html',
  'devs.html',
  'admin.html',
]

const forbiddenDistPaths = [
  '.agents',
  '.claude',
  '.codex-run',
  '.kiro',
  '.trae',
  '.windsurf',
  'admin-panel-mock.html',
  'Create_a_hyper_cinematic_D_im.mp4',
  'TechTokenHeist_Rulebook (1).docx',
]

const collectFiles = (directory) => {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }

  return files
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

const isTextArtifact = (filePath) => /\.(css|html|js|json|svg|txt|xml)$/i.test(filePath)

const failures = []
const fail = (message) => failures.push(message)

if (!existsSync(distDir)) {
  fail('dist directory does not exist. Run npm run build first.')
} else {
  for (const relativePath of forbiddenDistPaths) {
    if (existsSync(join(distDir, relativePath))) {
      fail(`dist contains forbidden local artifact: ${relativePath}`)
    }
  }

  for (const entrypoint of HTML_ENTRYPOINTS) {
    const htmlPath = join(distDir, entrypoint)
    if (!existsSync(htmlPath)) {
      fail(`dist is missing HTML entrypoint: ${entrypoint}`)
      continue
    }

    const html = readFileSync(htmlPath, 'utf8')
    if (!html.includes(`content="${EVENT_BUILD_MARKER}"`)) {
      fail(`${entrypoint} is missing event build marker ${EVENT_BUILD_MARKER}`)
    }
    if (!html.includes('<div id="root"></div>')) {
      fail(`${entrypoint} is missing the React root element`)
    }
    if (!/<script[^>]+type="module"[^>]+src="\/assets\/[^"]+\.js"/i.test(html)) {
      fail(`${entrypoint} does not reference a bundled module script`)
    }
  }

  const files = collectFiles(distDir)
  const text = files
    .filter((filePath) => isTextArtifact(filePath))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n')

  const forbiddenPatterns = [
    [/sb_secret_[A-Za-z0-9_-]+/i, 'dist contains an sb_secret_ Supabase secret key'],
    [/admin123/i, 'dist contains the old hardcoded admin password'],
    [/SET_PASSWORD_HASH/, 'dist contains the placeholder admin password hash marker'],
    [/admin-panel-mock/i, 'dist references the old standalone admin mock'],
    [/Create_a_hyper_cinematic_D_im/i, 'dist references a local generated media artifact'],
    [/TechTokenHeist_Rulebook \(1\)/i, 'dist references a local generated rulebook document'],
  ]

  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(text)) fail(message)
  }

  const jwtMatches = [...text.matchAll(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)]
    .map((match) => match[0])
  if (jwtMatches.some((token) => parseJwtPayload(token)?.role === 'service_role')) {
    fail('dist contains a Supabase service-role JWT')
  }

  const oversizedRootFiles = files
    .filter((filePath) => !relative(distDir, filePath).startsWith('assets'))
    .filter((filePath) => statSync(filePath).size > 1024 * 1024)
    .map((filePath) => relative(distDir, filePath).replace(/\\/g, '/'))
  if (oversizedRootFiles.length > 0) {
    fail(`dist contains oversized non-asset files: ${oversizedRootFiles.join(', ')}`)
  }
}

if (failures.length > 0) {
  console.error('Dist artifact verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Dist artifact verification passed.')
