import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = resolve(rootDir, 'dist')
const vercelConfigPath = resolve(rootDir, 'vercel.json')
const EVENT_BUILD_MARKER = 'event-hardening-2026-05-16'

const HTML_ROUTES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/login', 'login.html'],
  ['/login.html', 'login.html'],
  ['/lobby', 'lobby.html'],
  ['/lobby.html', 'lobby.html'],
  ['/arena', 'arena.html'],
  ['/arena.html', 'arena.html'],
  ['/battle', 'battle.html'],
  ['/battle.html', 'battle.html'],
  ['/rulebook', 'rulebook.html'],
  ['/rulebook.html', 'rulebook.html'],
  ['/about', 'about.html'],
  ['/about.html', 'about.html'],
  ['/devs', 'devs.html'],
  ['/devs.html', 'devs.html'],
  ['/admin', 'admin.html'],
  ['/admin.html', 'admin.html'],
])

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

const failures = []
const fail = (message) => failures.push(message)

const assertVercelCleanUrls = () => {
  if (!existsSync(vercelConfigPath)) {
    fail('vercel.json is missing.')
    return
  }

  const config = JSON.parse(readFileSync(vercelConfigPath, 'utf8'))
  if (config.cleanUrls !== true) {
    fail('vercel.json must keep cleanUrls enabled so /login serves login.html.')
  }
  if (config.trailingSlash !== false) {
    fail('vercel.json must keep trailingSlash disabled for canonical event URLs.')
  }
}

const safeDistPath = (relativePath) => {
  const candidate = resolve(distDir, relativePath.replace(/^\/+/, ''))
  const pathFromDist = relative(distDir, candidate)
  if (pathFromDist.startsWith('..') || isAbsolute(pathFromDist)) return null
  return candidate
}

const getStaticFileForPath = (pathname) => {
  const htmlEntry = HTML_ROUTES.get(pathname)
  if (htmlEntry) return safeDistPath(htmlEntry)
  if (pathname === '/favicon.svg') return safeDistPath('favicon.svg')
  if (pathname.startsWith('/assets/')) return safeDistPath(pathname.slice(1))
  return null
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

const collectInternalAssets = (html) => [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((assetPath) => assetPath.startsWith('/') && !assetPath.startsWith('//'))

const checkHtmlRoute = async (baseUrl, route) => {
  const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' })
  if (response.status !== 200) {
    fail(`${route} returned HTTP ${response.status}`)
    return []
  }
  if (!response.headers.get('content-type')?.includes('text/html')) {
    fail(`${route} did not return HTML content.`)
  }

  const html = await response.text()
  if (!html.includes(`content="${EVENT_BUILD_MARKER}"`)) {
    fail(`${route} is missing event build marker ${EVENT_BUILD_MARKER}.`)
  }
  if (!html.includes('<div id="root"></div>')) {
    fail(`${route} is missing the React root.`)
  }
  if (!/<script[^>]+type="module"[^>]+src="\/assets\/[^"]+\.js"/i.test(html)) {
    fail(`${route} does not load a bundled module script.`)
  }

  return collectInternalAssets(html)
}

const checkAsset = async (baseUrl, assetPath) => {
  const response = await fetch(`${baseUrl}${assetPath}`, { method: 'HEAD', redirect: 'manual' })
  if (response.status !== 200) {
    fail(`${assetPath} returned HTTP ${response.status}`)
    return
  }
  const length = Number(response.headers.get('content-length') || 0)
  if (!Number.isFinite(length) || length <= 0) {
    fail(`${assetPath} has an empty or missing Content-Length.`)
  }
}

if (!existsSync(distDir)) {
  fail('dist directory does not exist. Run npm run build first.')
}

assertVercelCleanUrls()

if (failures.length === 0) {
  const server = createDistServer()
  try {
    const port = await listen(server)
    const baseUrl = `http://127.0.0.1:${port}`
    const allAssets = new Set()

    for (const route of HTML_ROUTES.keys()) {
      const routeAssets = await checkHtmlRoute(baseUrl, route)
      routeAssets.forEach((assetPath) => allAssets.add(assetPath))
    }

    for (const assetPath of [...allAssets].sort()) {
      await checkAsset(baseUrl, assetPath)
    }
  } finally {
    await closeServer(server)
  }
}

if (failures.length > 0) {
  console.error('Static route verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Static route verification passed.')
