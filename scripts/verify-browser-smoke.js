import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const viteBin = resolve(rootDir, 'node_modules/vite/bin/vite.js')
const tempDir = mkdtempSync(join(tmpdir(), 'tth-browser-smoke-'))
const distDir = resolve(tempDir, 'dist')
const LOCAL_NETWORK_BROWSER_ARGS = ['--disable-features=LocalNetworkAccessChecks']

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

const expectedMissingConfigConsoleError =
  'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to real Supabase values before running the event build.'

const buildMissingConfigBundle = () => {
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
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  })

  if (result.error) {
    throw new Error(`Could not start browser smoke build: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`Browser smoke build failed.\n${result.stdout || ''}\n${result.stderr || ''}`)
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

const parseViewport = (viewport) => {
  const [width, height] = viewport.split(',').map((value) => Number(value.trim()))
  return { width, height }
}

const verifyScreenshot = async ({ browser, baseUrl, route, viewport, outputPath }) => {
  const context = await browser.newContext({ viewport: parseViewport(viewport) })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error' && text !== expectedMissingConfigConsoleError) {
      consoleErrors.push(text)
    }
  })

  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid=supabase-config-missing]').waitFor({ timeout: 30000 })
    await page.waitForTimeout(800)

    if (pageErrors.length > 0) {
      throw new Error(`${route} raised page errors:\n${pageErrors.join('\n')}`)
    }
    if (consoleErrors.length > 0) {
      throw new Error(`${route} logged console errors:\n${consoleErrors.join('\n')}`)
    }

    await page.screenshot({ path: outputPath, fullPage: true })
  } finally {
    await context.close()
  }

  const size = statSync(outputPath).size
  if (size < 5000) {
    throw new Error(`Chromium smoke screenshot for ${route} at ${viewport} is unexpectedly small (${size} bytes).`)
  }
}

if (!existsSync(viteBin)) {
  console.error('Browser smoke verification failed: Vite is not installed. Run npm install first.')
  process.exit(1)
}

let server
let browser

try {
  buildMissingConfigBundle()
  server = createDistServer()
  const port = await listen(server)
  const baseUrl = `http://127.0.0.1:${port}`
  browser = await launchSmokeBrowser()

  const checks = [
    { route: '/', viewport: '1366,768', name: 'home-desktop' },
    { route: '/login', viewport: '1366,768', name: 'login-desktop' },
    { route: '/admin', viewport: '1366,768', name: 'admin-desktop' },
    { route: '/', viewport: '390,844', name: 'home-mobile' },
  ]

  for (const check of checks) {
    await verifyScreenshot({
      browser,
      baseUrl,
      route: check.route,
      viewport: check.viewport,
      outputPath: join(tempDir, `${check.name}.png`),
    })
  }
} catch (error) {
  console.error('Browser smoke verification failed:')
  if (/Executable doesn't exist|browserType\.launch|Please run the following command/i.test(error.message)) {
    console.error('Playwright Chromium is not installed. Run: npm exec --yes playwright -- install chromium')
  } else {
    console.error(error.message)
  }
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) await closeServer(server)
  rmSync(tempDir, { recursive: true, force: true })
}

if (process.exitCode !== 1) {
  console.log('Browser smoke verification passed.')
}
