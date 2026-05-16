import { spawnSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const viteBin = resolve(rootDir, 'node_modules/vite/bin/vite.js')
const tempDir = mkdtempSync(join(tmpdir(), 'tth-configured-smoke-'))
const distDir = resolve(tempDir, 'dist')
const LOCAL_NETWORK_BROWSER_ARGS = ['--disable-features=LocalNetworkAccessChecks']

const SMOKE_SUPABASE_URL = 'https://configured-smoke-tth.supabase.co'
const AUTH_STORAGE_KEY = 'heist-auth-storage'
const CONFIGURED_TEAM_ID = '00000000-0000-4000-8000-000000000100'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': [
    'accept',
    'accept-profile',
    'apikey',
    'authorization',
    'content-profile',
    'content-type',
    'prefer',
    'x-admin-session-token',
    'x-client-info',
  ].join(', '),
  'access-control-expose-headers': 'content-range',
}

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

const encodeJwtPart = (value) => Buffer
  .from(JSON.stringify(value))
  .toString('base64url')

const createFakeAnonJwt = () => [
  encodeJwtPart({ alg: 'HS256', typ: 'JWT' }),
  encodeJwtPart({
    role: 'anon',
    iss: 'supabase',
    exp: 4102444800,
  }),
  'configured-smoke-signature',
].join('.')

const buildConfiguredBundle = () => {
  if (!existsSync(viteBin)) {
    throw new Error('Vite is not installed. Run npm install first.')
  }

  const result = spawnSync(process.execPath, [
    viteBin,
    'build',
    '--outDir',
    distDir,
    '--emptyOutDir',
  ], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: SMOKE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: createFakeAnonJwt(),
    },
  })

  if (result.error) {
    throw new Error(`Could not start configured browser smoke build: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`Configured browser smoke build failed.\n${result.stdout || ''}\n${result.stderr || ''}`)
  }
}

const safeDistPath = (pathname) => {
  const normalizedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = resolve(distDir, normalizedPath)
  const pathFromDist = relative(distDir, candidate)
  if (pathFromDist.startsWith('..') || isAbsolute(pathFromDist)) return null
  return candidate
}

const getStaticFileForPath = (pathname) => {
  const requestedFile = safeDistPath(pathname)
  if (requestedFile && existsSync(requestedFile) && statSync(requestedFile).isFile()) {
    return requestedFile
  }

  if (pathname.startsWith('/assets/')) return null
  return safeDistPath('/index.html')
}

const createDistServer = () => createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end()
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
  } catch {
    response.writeHead(400)
    response.end('Bad request')
    return
  }

  const filePath = getStaticFileForPath(pathname)
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404)
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Content-Length': statSync(filePath).size,
    'Content-Type': CONTENT_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
  })

  if (request.method === 'HEAD') {
    response.end()
  } else {
    createReadStream(filePath).pipe(response)
  }
})

const listen = (server) => new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen)
  server.listen(0, '127.0.0.1', () => resolveListen(server.address().port))
})

const closeServer = (server) => new Promise((resolveClose) => {
  server.close(() => resolveClose())
})

const launchSmokeBrowser = () => chromium.launch({
  args: LOCAL_NETWORK_BROWSER_ARGS,
})

const jsonFulfill = (route, status, body) => route.fulfill({
  status,
  headers: {
    ...CORS_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'content-range': '0-0/*',
  },
  body: JSON.stringify(body),
})

const emptyFulfill = (route, status = 204) => route.fulfill({
  status,
  headers: CORS_HEADERS,
  body: '',
})

const createSmokeRows = () => ({
  system: [{
    key: 'game',
    status: 'not_started',
    is_game_active: false,
    is_paused: false,
    phase: 'phase1',
    game_started_at: null,
    paused_at: null,
    timeout_duration_override: null,
    domains: ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'],
  }],
  teams: [{
    id: CONFIGURED_TEAM_ID,
    name: 'Configured Smoke',
    member_names: ['Configured Leader'],
    leader: 'Configured Leader',
    tokens: 1,
    status: 'idle',
    total_time: 0,
    timeout_until: null,
    last_token_update_time: null,
    created_at: new Date().toISOString(),
  }],
  matchmaking_queue: [],
  active_matches: [],
  match_history: [],
  notifications: [],
  token_history: [],
})

const createReadOnlySupabaseRouteHandler = () => {
  const rows = createSmokeRows()

  return async (route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const url = new URL(request.url())

    if (method === 'OPTIONS') {
      await emptyFulfill(route)
      return
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      await jsonFulfill(route, 200, null)
      return
    }

    if (!url.pathname.startsWith('/rest/v1/')) {
      await jsonFulfill(route, 200, {})
      return
    }

    const tableName = decodeURIComponent(url.pathname.replace('/rest/v1/', ''))
    await jsonFulfill(route, 200, rows[tableName] || [])
  }
}

const shouldIgnoreConsoleError = (text) => (
  text.includes(`WebSocket connection to 'wss://${new URL(SMOKE_SUPABASE_URL).hostname}/realtime/v1/websocket`) &&
  text.includes('net::ERR_NAME_NOT_RESOLVED')
)

const createPersistedAuth = (user) => JSON.stringify({
  state: { user },
  version: 0,
})

const futureSessionExpiry = () => Date.now() + 60 * 60 * 1000

const routeChecks = [
  {
    name: 'landing-configured',
    route: '/',
    viewport: { width: 1366, height: 768 },
    text: 'you are invited',
    minScreenshotBytes: 3000,
  },
  {
    name: 'login-configured',
    route: '/login',
    viewport: { width: 1366, height: 768 },
    text: 'ENTRY PROTOCOL',
  },
  {
    name: 'admin-configured',
    route: '/admin',
    viewport: { width: 1366, height: 768 },
    text: "THE PROFESSOR'S DIRECTORY",
    storageValue: createPersistedAuth({
      role: 'admin',
      teamId: null,
      teamName: null,
      adminSessionToken: 'configured-smoke-admin-session',
      adminSessionExpiresAt: futureSessionExpiry(),
    }),
  },
  {
    name: 'player-configured',
    route: '/lobby',
    viewport: { width: 390, height: 844 },
    text: 'AWAITING',
    storageValue: createPersistedAuth({
      role: 'player',
      teamId: CONFIGURED_TEAM_ID,
      teamName: 'Configured Smoke',
    }),
  },
  {
    name: 'arena-configured',
    route: '/arena',
    viewport: { width: 1366, height: 768 },
    text: 'ARENA LOCKED',
    storageValue: createPersistedAuth({
      role: 'player',
      teamId: CONFIGURED_TEAM_ID,
      teamName: 'Configured Smoke',
    }),
  },
  {
    name: 'battle-configured',
    route: '/battle',
    viewport: { width: 1366, height: 768 },
    text: 'COMBAT FEED',
    storageValue: createPersistedAuth({
      role: 'player',
      teamId: CONFIGURED_TEAM_ID,
      teamName: 'Configured Smoke',
    }),
  },
  {
    name: 'rulebook-configured',
    route: '/rulebook',
    viewport: { width: 1366, height: 768 },
    text: 'THE PLAN',
    storageValue: createPersistedAuth({
      role: 'player',
      teamId: CONFIGURED_TEAM_ID,
      teamName: 'Configured Smoke',
    }),
  },
  {
    name: 'about-configured',
    route: '/about',
    viewport: { width: 1366, height: 768 },
    text: 'RVITM BENGALURU',
    storageValue: createPersistedAuth({
      role: 'player',
      teamId: CONFIGURED_TEAM_ID,
      teamName: 'Configured Smoke',
    }),
  },
  {
    name: 'devs-configured',
    route: '/devs',
    viewport: { width: 1366, height: 768 },
    text: 'THE ARCHITECTS',
    storageValue: createPersistedAuth({
      role: 'player',
      teamId: CONFIGURED_TEAM_ID,
      teamName: 'Configured Smoke',
    }),
  },
]

const assertConfiguredRoute = async ({ browser, baseUrl, check }) => {
  const context = await browser.newContext({ viewport: check.viewport })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error' && !shouldIgnoreConsoleError(text)) {
      consoleErrors.push(text)
    }
  })
  await page.route(`${SMOKE_SUPABASE_URL}/**`, createReadOnlySupabaseRouteHandler())

  if (check.storageValue) {
    await page.addInitScript(({ key, value }) => {
      window.localStorage.setItem(key, value)
    }, {
      key: AUTH_STORAGE_KEY,
      value: check.storageValue,
    })
  }

  await page.goto(`${baseUrl}${check.route}`, { waitUntil: 'domcontentloaded' })
  try {
    await page.getByText(check.text, { exact: false }).first().waitFor({ timeout: 30000 })
  } catch (error) {
    const visibleText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '<body text unavailable>')
    throw new Error([
      `${check.route} did not render expected text "${check.text}".`,
      `Current URL: ${page.url()}`,
      `Visible text: ${visibleText.slice(0, 1500)}`,
      `Original error: ${error.message}`,
    ].join('\n'), { cause: error })
  }

  const missingConfigCount = await page.locator('[data-testid=supabase-config-missing]').count()
  if (missingConfigCount > 0) {
    throw new Error(`${check.route} rendered the missing Supabase config guard even though smoke config was provided.`)
  }

  if (pageErrors.length > 0) {
    throw new Error(`${check.route} raised page errors:\n${pageErrors.join('\n')}`)
  }
  if (consoleErrors.length > 0) {
    throw new Error(`${check.route} logged console errors:\n${consoleErrors.join('\n')}`)
  }

  const screenshotPath = resolve(tempDir, `${check.name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  const size = statSync(screenshotPath).size
  const minScreenshotBytes = check.minScreenshotBytes || 5000
  if (size < minScreenshotBytes) {
    throw new Error(`${check.route} screenshot is unexpectedly small (${size} bytes).`)
  }

  await context.close()
}

let server
let browser

try {
  buildConfiguredBundle()
  server = createDistServer()
  const port = await listen(server)
  const baseUrl = `http://127.0.0.1:${port}`
  browser = await launchSmokeBrowser()

  for (const check of routeChecks) {
    await assertConfiguredRoute({ browser, baseUrl, check })
  }
} catch (error) {
  console.error('Configured browser smoke verification failed:')
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) await closeServer(server)
  rmSync(tempDir, { recursive: true, force: true })
}

if (process.exitCode !== 1) {
  console.log('Configured browser smoke verification passed.')
}
