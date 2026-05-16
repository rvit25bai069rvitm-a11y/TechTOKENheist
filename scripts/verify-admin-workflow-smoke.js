import { Buffer } from 'node:buffer'
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
const tempDir = mkdtempSync(join(tmpdir(), 'tth-admin-workflow-smoke-'))
const distDir = resolve(tempDir, 'dist')
const LOCAL_NETWORK_BROWSER_ARGS = ['--disable-features=LocalNetworkAccessChecks']

const SMOKE_SUPABASE_URL = 'https://admin-workflow-smoke-tth.supabase.co'
const AUTH_STORAGE_KEY = 'heist-auth-storage'
const DEFAULT_DOMAINS = ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition']
const smokeUuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`

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
  'admin-workflow-smoke-signature',
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
    throw new Error(`Could not start admin workflow smoke build: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`Admin workflow smoke build failed.\n${result.stdout || ''}\n${result.stderr || ''}`)
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

const shouldIgnoreConsoleError = (text) => (
  text.includes(`WebSocket connection to 'wss://${new URL(SMOKE_SUPABASE_URL).hostname}/realtime/v1/websocket`) &&
  text.includes('net::ERR_NAME_NOT_RESOLVED')
)

const createPersistedAdminAuth = () => JSON.stringify({
  state: {
    user: {
      role: 'admin',
      teamId: null,
      teamName: null,
      adminSessionToken: 'admin-workflow-smoke-session',
      adminSessionExpiresAt: Date.now() + 60 * 60 * 1000,
    },
  },
  version: 0,
})

const createMockState = () => ({
  system: {
    key: 'game',
    status: 'not_started',
    is_game_active: false,
    is_paused: false,
    phase: 'phase1',
    game_started_at: null,
    paused_at: null,
    timeout_duration_override: null,
    domains: DEFAULT_DOMAINS,
  },
  teams: [
    {
      id: smokeUuid(1),
      name: 'Seed Crew',
      member_names: ['Seed Leader'],
      leader: 'Seed Leader',
      password: 'Pass123!',
      tokens: 1,
      status: 'idle',
      total_time: 0,
      timeout_until: null,
      last_token_update_time: null,
      created_at: new Date().toISOString(),
    },
  ],
  matchmaking_queue: [],
  active_matches: [],
  match_history: [],
  notifications: [],
  token_history: [],
  ids: {
    team: 2,
    queue: 1,
    match: 1,
    history: 1,
    notification: 1,
    tokenHistory: 1,
  },
})

const getRows = (state, tableName) => {
  if (tableName === 'system') return [state.system]
  return state[tableName] || []
}

const createPublicStatePayload = (state) => ({
  systemRows: [state.system],
  teamsRows: state.teams,
  queueRows: state.matchmaking_queue,
  matchRows: state.active_matches,
  historyRows: state.match_history,
  notificationRows: state.notifications,
  tokenHistory: state.token_history,
})

const setRows = (state, tableName, rows) => {
  if (tableName === 'system') {
    state.system = rows[0] || state.system
  } else {
    state[tableName] = rows
  }
}

const matchesFilter = (row, key, value) => {
  if (key === 'select' || key === 'order' || key === 'limit' || key === 'columns' || key === 'on_conflict') return true

  if (key === 'or') {
    const conditions = value.replace(/^\(|\)$/g, '').split(',')
    return conditions.some((condition) => {
      const [field, operator, ...rest] = condition.split('.')
      if (operator !== 'eq') return true
      return String(row[field] ?? '') === rest.join('.')
    })
  }

  if (value.startsWith('eq.')) return String(row[key] ?? '') === value.slice(3)
  if (value.startsWith('neq.')) return String(row[key] ?? '') !== value.slice(4)
  if (value.startsWith('lte.')) return Number(row[key] ?? 0) <= Number(value.slice(4))
  if (value.startsWith('in.(') && value.endsWith(')')) {
    return value.slice(4, -1).split(',').includes(String(row[key] ?? ''))
  }
  if (value.startsWith('is.')) {
    const expected = value.slice(3)
    if (expected === 'null') return row[key] === null || row[key] === undefined
  }

  return true
}

const applyFilters = (rows, searchParams) => rows.filter((row) => {
  for (const [key, value] of searchParams.entries()) {
    if (!matchesFilter(row, key, value)) return false
  }
  return true
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

const normalizeRequestBody = (request) => {
  const raw = request.postData()
  if (!raw) return null
  return JSON.parse(raw)
}

const insertQueueRow = (state, team) => {
  if (!team || (team.tokens ?? 0) <= 0 || team.status !== 'idle') return
  const existing = state.matchmaking_queue.find((row) => row.team_id === team.id)
  if (existing) {
    existing.team_name = team.name
    existing.team_tokens = team.tokens
    existing.matched_with = null
    return
  }

  state.matchmaking_queue.push({
    id: `smoke-queue-${state.ids.queue++}`,
    team_id: team.id,
    team_name: team.name,
    team_tokens: team.tokens ?? 0,
    matched_with: null,
    created_at: new Date().toISOString(),
  })
}

const queuePair = (state, teamA, teamB) => {
  insertQueueRow(state, teamA)
  insertQueueRow(state, teamB)
  const rowA = state.matchmaking_queue.find((row) => row.team_id === teamA.id)
  const rowB = state.matchmaking_queue.find((row) => row.team_id === teamB.id)
  if (rowA && rowB) {
    rowA.matched_with = teamB.id
    rowB.matched_with = teamA.id
  }
}

const createMatchRow = (state, teamAId, teamBId, domain) => {
  const teamA = state.teams.find((team) => team.id === teamAId)
  const teamB = state.teams.find((team) => team.id === teamBId)
  if (!teamA || !teamB) return null

  const match = {
    id: `smoke-match-${state.ids.match++}`,
    team_a: teamA.id,
    team_b: teamB.id,
    domain,
    start_time: Date.now(),
    is_wager: state.system.phase === 'phase2',
    teamA: { ...teamA, password: undefined },
    teamB: { ...teamB, password: undefined },
    created_at: new Date().toISOString(),
  }

  state.active_matches.push(match)
  teamA.status = 'fighting'
  teamB.status = 'fighting'
  state.matchmaking_queue = state.matchmaking_queue
    .filter((row) => ![teamA.id, teamB.id].includes(row.team_id))
    .map((row) => ([teamA.id, teamB.id].includes(row.matched_with) ? { ...row, matched_with: null } : row))

  return match
}

const declare_match_winner = (state, body) => {
  const matchId = body?.p_match_id
  const winnerId = body?.p_winner_id
  const matchIndex = state.active_matches.findIndex((match) => match.id === matchId)
  const match = state.active_matches[matchIndex]
  if (!match || ![match.team_a, match.team_b].includes(winnerId)) return null

  state.active_matches.splice(matchIndex, 1)
  const loserId = match.team_a === winnerId ? match.team_b : match.team_a
  const winner = state.teams.find((team) => team.id === winnerId)
  const loser = state.teams.find((team) => team.id === loserId)
  if (!winner || !loser) return null

  winner.tokens = (winner.tokens ?? 1) + 1
  winner.status = 'idle'
  winner.timeout_until = null
  loser.tokens = Math.max(0, (loser.tokens ?? 1) - 1)
  loser.status = loser.tokens === 0 ? 'timeout' : 'idle'
  loser.timeout_until = loser.status === 'timeout' ? Date.now() + 5 * 60 * 1000 : null

  state.match_history.push({
    id: `smoke-history-${state.ids.history++}`,
    winner_id: winner.id,
    loser_id: loser.id,
    winner: winner.name,
    loser: loser.name,
    domain: match.domain,
    timestamp: body?.p_timestamp || new Date().toLocaleTimeString(),
    is_wager: false,
    created_at: new Date().toISOString(),
  })
  state.notifications.push({
    id: `smoke-notification-${state.ids.notification++}`,
    message: `${winner.name} defeated ${loser.name}`,
    time: body?.p_timestamp || new Date().toLocaleTimeString(),
    created_at: new Date().toISOString(),
  })
  state.token_history.push(
    {
      id: `smoke-token-${state.ids.tokenHistory++}`,
      team: winner.name,
      change: '+1',
      reason: 'Match win',
      timestamp: body?.p_timestamp || new Date().toLocaleTimeString(),
    },
    {
      id: `smoke-token-${state.ids.tokenHistory++}`,
      team: loser.name,
      change: '-1',
      reason: 'Match loss',
      timestamp: body?.p_timestamp || new Date().toLocaleTimeString(),
    },
  )

  state.matchmaking_queue = state.matchmaking_queue
    .filter((row) => ![winner.id, loser.id].includes(row.team_id))
    .map((row) => ([winner.id, loser.id].includes(row.matched_with) ? { ...row, matched_with: null } : row))
  insertQueueRow(state, winner)
  insertQueueRow(state, loser)

  return {
    matchId,
    winnerId: winner.id,
    loserId: loser.id,
    winnerTokens: winner.tokens,
    loserTokens: loser.tokens,
    loserStatus: loser.status,
    isWager: false,
  }
}

const createSupabaseRouteHandler = (state) => async (route) => {
  const request = route.request()
  const method = request.method().toUpperCase()
  const url = new URL(request.url())

  if (method === 'OPTIONS') {
    await emptyFulfill(route)
    return
  }

  if (url.pathname === '/functions/v1/public-state') {
    await jsonFulfill(route, 200, createPublicStatePayload(state))
    return
  }

  if (url.pathname === '/functions/v1/game-actions') {
    const body = normalizeRequestBody(request) || {}
    const payload = body.payload || {}

    if (body.action === 'createTeam') {
      const team = {
        id: smokeUuid(state.ids.team++),
        name: payload.name,
        member_names: payload.memberNames || [],
        leader: payload.leader || payload.memberNames?.[0] || payload.name,
        password: payload.password,
        tokens: payload.tokens ?? 1,
        status: payload.status || 'idle',
        total_time: 0,
        timeout_until: null,
        last_token_update_time: null,
        created_at: new Date().toISOString(),
      }
      state.teams.push(team)
      await jsonFulfill(route, 200, { success: true, data: team })
      return
    }

    if (body.action === 'startGame') {
      state.system.status = 'active'
      state.system.is_game_active = true
      state.system.is_paused = false
      state.system.game_started_at = Date.now()
      state.matchmaking_queue = []
      const eligible = state.teams.filter((team) => team.status === 'idle' && (team.tokens ?? 0) > 0)
      for (let index = 0; index + 1 < eligible.length; index += 2) {
        queuePair(state, eligible[index], eligible[index + 1])
      }
      await jsonFulfill(route, 200, { success: true, data: createPublicStatePayload(state) })
      return
    }

    if (body.action === 'createMatch') {
      const match = createMatchRow(state, payload.teamAId, payload.teamBId, payload.domain)
      await jsonFulfill(route, match ? 200 : 400, match
        ? { success: true, data: match }
        : { success: false, error: 'Teams unavailable for smoke match' })
      return
    }

    if (body.action === 'declareWinner') {
      const result = declare_match_winner(state, {
        p_match_id: payload.matchId,
        p_winner_id: payload.winnerId,
        p_timestamp: new Date().toLocaleTimeString(),
      })
      await jsonFulfill(route, result ? 200 : 400, result
        ? { success: true, data: result }
        : { success: false, error: 'Smoke winner declaration failed' })
      return
    }

    if (body.action === 'stopGame') {
      state.system.status = 'paused'
      state.system.is_paused = true
      state.system.paused_at = Date.now()
      await jsonFulfill(route, 200, { success: true, data: createPublicStatePayload(state) })
      return
    }

    if (body.action === 'resetGame') {
      state.system.status = 'not_started'
      state.system.is_game_active = false
      state.system.is_paused = false
      state.system.game_started_at = null
      state.system.paused_at = null
      state.matchmaking_queue = []
      state.active_matches = []
      state.teams.forEach((team) => {
        team.status = 'idle'
        team.timeout_until = null
      })
      await jsonFulfill(route, 200, { success: true, data: createPublicStatePayload(state) })
      return
    }

    await jsonFulfill(route, 200, { success: true, data: createPublicStatePayload(state) })
    return
  }

  if (!url.pathname.startsWith('/rest/v1/')) {
    await jsonFulfill(route, 200, {})
    return
  }

  if (url.pathname === '/rest/v1/rpc/declare_match_winner' && method === 'POST') {
    const result = declare_match_winner(state, normalizeRequestBody(request))
    await jsonFulfill(route, 200, result)
    return
  }

  const tableName = decodeURIComponent(url.pathname.replace('/rest/v1/', ''))

  if (method === 'GET') {
    await jsonFulfill(route, 200, applyFilters(getRows(state, tableName), url.searchParams))
    return
  }

  if (method === 'POST') {
    const rows = Array.isArray(normalizeRequestBody(request))
      ? normalizeRequestBody(request)
      : [normalizeRequestBody(request)]

    if (tableName === 'teams') {
      const inserted = rows.map((row) => {
        const existing = state.teams.find((team) => team.name === row.name)
        if (existing) {
          Object.assign(existing, {
            member_names: row.member_names || existing.member_names || [],
            leader: row.leader || existing.leader || row.name,
            password: row.password || existing.password,
            tokens: row.tokens ?? existing.tokens ?? 1,
            status: row.status || existing.status || 'idle',
          })
          return existing
        }

        const team = {
          id: smokeUuid(state.ids.team++),
          name: row.name,
          member_names: row.member_names || [],
          leader: row.leader || row.name,
          password: row.password,
          tokens: row.tokens ?? 1,
          status: row.status || 'idle',
          total_time: 0,
          timeout_until: null,
          last_token_update_time: null,
          created_at: new Date().toISOString(),
        }
        state.teams.push(team)
        return team
      })
      await jsonFulfill(route, 201, inserted)
      return
    }

    if (tableName === 'matchmaking_queue') {
      const inserted = []
      for (const row of rows) {
        if (state.matchmaking_queue.some((queueRow) => queueRow.team_id === row.team_id)) continue
        const queueRow = {
          id: `smoke-queue-${state.ids.queue++}`,
          team_id: row.team_id,
          team_name: row.team_name,
          team_tokens: row.team_tokens ?? 0,
          matched_with: row.matched_with || null,
          created_at: new Date().toISOString(),
        }
        state.matchmaking_queue.push(queueRow)
        inserted.push(queueRow)
      }
      await jsonFulfill(route, 201, inserted)
      return
    }

    if (tableName === 'active_matches') {
      const inserted = rows.map((row) => ({
        id: `smoke-match-${state.ids.match++}`,
        created_at: new Date().toISOString(),
        ...row,
      }))
      state.active_matches.push(...inserted)
      await jsonFulfill(route, 201, inserted)
      return
    }

    if (tableName === 'notifications') {
      const inserted = rows.map((row) => ({
        id: `smoke-notification-${state.ids.notification++}`,
        created_at: new Date().toISOString(),
        ...row,
      }))
      state.notifications.push(...inserted)
      await jsonFulfill(route, 201, inserted)
      return
    }

    await jsonFulfill(route, 201, rows)
    return
  }

  if (method === 'PATCH') {
    const body = normalizeRequestBody(request) || {}
    const rows = getRows(state, tableName)
    const matchingRows = applyFilters(rows, url.searchParams)
    const matchingIds = new Set(matchingRows.map((row) => row.id || row.team_id || row.key))
    const updatedRows = rows.map((row) => (
      matchingIds.has(row.id || row.team_id || row.key)
        ? { ...row, ...body }
        : row
    ))
    const returnedRows = matchingRows.map((row) => ({ ...row, ...body }))
    setRows(state, tableName, updatedRows)
    await jsonFulfill(route, 200, returnedRows)
    return
  }

  if (method === 'DELETE') {
    const rows = getRows(state, tableName)
    const remainingRows = rows.filter((row) => !applyFilters([row], url.searchParams).length)
    setRows(state, tableName, remainingRows)
    await jsonFulfill(route, 200, [])
    return
  }

  await jsonFulfill(route, 405, { error: `Unhandled method ${method}` })
}

const waitForText = async (page, text, diagnostics = {}) => {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 30000 })
  } catch (error) {
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const requestFailures = diagnostics.requestFailures?.length
      ? `\n\nRequest failures:\n${diagnostics.requestFailures.join('\n')}`
      : ''
    const pageErrors = diagnostics.pageErrors?.length
      ? `\n\nPage errors:\n${diagnostics.pageErrors.join('\n')}`
      : ''
    const consoleErrors = diagnostics.consoleErrors?.length
      ? `\n\nConsole errors:\n${diagnostics.consoleErrors.join('\n')}`
      : ''
    throw new Error(`Timed out waiting for text "${text}". Visible text excerpt:\n${bodyText.slice(0, 2000)}${requestFailures}${pageErrors}${consoleErrors}\n\n${error.message}`, { cause: error })
  }
}

const waitForState = async (predicate, describe, state) => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`${describe}. Current smoke state: ${JSON.stringify({
    teams: state.teams.map((team) => ({ id: team.id, name: team.name, status: team.status, tokens: team.tokens })),
    queue: state.matchmaking_queue.map((row) => ({ team_id: row.team_id, team_name: row.team_name, matched_with: row.matched_with })),
    activeMatches: state.active_matches.map((match) => ({ id: match.id, team_a: match.team_a, team_b: match.team_b, domain: match.domain })),
    history: state.match_history.length,
  })}`)
}

const createTeamFromAdmin = async (page, state, teamName, leaderName, expectedTeamCount) => {
  const form = page.locator('form').first()
  await page.getByRole('button', { name: /Custom/i }).click()
  await page.getByPlaceholder('e.g., phoenix_squad').fill(teamName)
  await page.getByPlaceholder(/Secret Passcode/i).fill('Pass123!')
  await page.getByPlaceholder('Add member name').fill(leaderName)
  await form.getByRole('button', { name: '+', exact: true }).click()
  await form.locator('select.input-heist').selectOption(leaderName)
  await form.getByRole('button', { name: /CREATE TEAM/i }).click()
  await waitForState(
    () => state.teams.length === expectedTeamCount && state.teams.some((team) => team.name === teamName),
    `Expected admin create-team flow to persist ${teamName}`,
    state,
  )
}

const runAdminWorkflow = async ({ browser, baseUrl }) => {
  const state = createMockState()
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()
  await page.route(`${SMOKE_SUPABASE_URL}/**`, createSupabaseRouteHandler(state))

  const requestFailures = []
  const pageErrors = []
  const consoleErrors = []
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`)
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error' && !shouldIgnoreConsoleError(text)) {
      consoleErrors.push(text)
    }
  })
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value)
  }, {
    key: AUTH_STORAGE_KEY,
    value: createPersistedAdminAuth(),
  })
  const diagnostics = { requestFailures, pageErrors, consoleErrors }

  await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded' })
  await waitForText(page, "THE PROFESSOR'S DIRECTORY", diagnostics)
  await waitForText(page, 'MISSION CONTROL', diagnostics)

  await waitForText(page, 'Seed Crew', diagnostics)
  await createTeamFromAdmin(page, state, 'Smoke Crew', 'Smoke Leader', 2)
  await waitForState(() => state.teams.length === 2, 'Expected the smoke fixture to contain two teams before starting', state)

  await page.getByRole('button', { name: /EXECUTE PLAN/i }).click()
  await page.getByRole('button', { name: /CONFIRM/i }).click()
  await waitForState(
    () => state.system.is_game_active && state.matchmaking_queue.some((row) => row.matched_with),
    'Expected start game to arm one ready queue pair',
    state,
  )
  await waitForText(page, 'PLANS READY', diagnostics)

  await page.getByRole('button', { name: /PLANS/i }).click()
  await waitForText(page, 'READY TO EXECUTE', diagnostics)
  await page.getByRole('button', { name: /SPIN WHEEL/i }).first().click()
  await page.getByRole('button', { name: /CONTINUE TO VAULTS/i }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /CONTINUE TO VAULTS/i }).click()
  await waitForState(() => state.active_matches.length === 1, 'Expected domain wheel to create one active match', state)
  await waitForText(page, 'ACTIVE MISSIONS', diagnostics)

  await page.getByRole('button', { name: /VAULTS/i }).click()
  await waitForText(page, 'ACTIVE MISSIONS (1)', diagnostics)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /DECLARE WINNER/i }).first().click()
  await waitForText(page, 'ACTIVE MISSIONS (0)', diagnostics)
  await waitForText(page, 'PLANS READY', diagnostics)

  await page.getByRole('button', { name: /ON HOLD/i }).click()
  await page.getByRole('button', { name: /CONFIRM/i }).click()
  await waitForState(() => state.system.is_paused, 'Expected hold mission to pause the smoke game', state)

  await page.getByRole('button', { name: /RESET PARAMETERS/i }).click()
  await page.getByPlaceholder('ENTER VERIFICATION KEY').fill('rvitmkimkc')
  await page.getByRole('button', { name: /CONFIRM/i }).click()
  await waitForState(
    () => !state.system.is_game_active && !state.system.is_paused && state.teams.length === 2 && state.active_matches.length === 0,
    'Expected reset parameters to stop the game and keep the configured teams',
    state,
  )
  await waitForText(page, 'MISSION CONTROL', diagnostics)

  const missingConfigCount = await page.locator('[data-testid=supabase-config-missing]').count()
  if (missingConfigCount > 0) {
    throw new Error('/admin rendered the missing Supabase config guard during the admin workflow smoke.')
  }

  if (pageErrors.length > 0) {
    throw new Error(`/admin raised page errors:\n${pageErrors.join('\n')}`)
  }
  if (requestFailures.length > 0) {
    throw new Error(`/admin had request failures:\n${requestFailures.join('\n')}`)
  }
  if (consoleErrors.length > 0) {
    throw new Error(`/admin logged console errors:\n${consoleErrors.join('\n')}`)
  }

  const screenshotPath = resolve(tempDir, 'admin-workflow.png')
  await page.screenshot({ path: screenshotPath, fullPage: true })
  const size = statSync(screenshotPath).size
  if (size < 5000) {
    throw new Error(`/admin workflow screenshot is unexpectedly small (${size} bytes).`)
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

  await runAdminWorkflow({ browser, baseUrl })
} catch (error) {
  console.error('Admin workflow smoke verification failed:')
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) await closeServer(server)
  rmSync(tempDir, { recursive: true, force: true })
}

if (process.exitCode !== 1) {
  console.log('Admin workflow smoke verification passed.')
}
