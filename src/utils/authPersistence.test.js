import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('protected routes wait for persisted auth hydration before redirecting', () => {
  const app = readProjectFile('src/App.jsx')
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /authHydrated:\s*false/)
  assert.match(useGameState, /onRehydrateStorage/)
  assert.match(useGameState, /setAuthHydrated\(true\)/)
  assert.match(app, /authHydrated/)
  assert.match(app, /if \(!authHydrated\)/)
})

test('persisted admin sessions are restored into the Supabase request header injector', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const supabaseClient = readProjectFile('src/lib/supabase.js')

  assert.match(supabaseClient, /ADMIN_SESSION_DURATION_MS = 12 \* 60 \* 60 \* 1000/)
  assert.match(useGameState, /const adminSessionExpiresAt = Date\.now\(\) \+ ADMIN_SESSION_DURATION_MS/)
  assert.match(useGameState, /Number\(state\.user\.adminSessionExpiresAt\) > Date\.now\(\)/)
  assert.match(useGameState, /setSupabaseAdminSessionToken\(persistedAdminSessionActive \? state\.user\.adminSessionToken : null\)/)
  assert.match(useGameState, /partialize: \(state\) => \(\{ user: state\.user \}\)/)
  assert.match(supabaseClient, /localStorage\.getItem\(AUTH_STORAGE_KEY\)/)
  assert.match(supabaseClient, /const user = parsed\?\.state\?\.user/)
  assert.match(supabaseClient, /user\?\.role === 'admin'/)
  assert.match(supabaseClient, /Number\(user\?\.adminSessionExpiresAt\) > Date\.now\(\)/)
  assert.match(supabaseClient, /return sessionActive \? token : null/)
})

test('stale player sessions clear after public state has loaded', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /hasFetchedPublicState:\s*false/)
  assert.match(useGameState, /hasFetchedPublicState:\s*true/)
  assert.match(useGameState, /if \(user\?\.role === 'player' && hasFetchedPublicState\)/)
  assert.doesNotMatch(useGameState, /teams\.length > 0 && !teamExists/)
})

test('public state fetch does not apply partial snapshots after query errors', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /publicStateError:\s*null/)
  assert.match(useGameState, /if \(queryErrors\.length > 0\) \{[\s\S]*throw new Error\('Failed to fetch public state from Supabase'\)[\s\S]*\}/)
  assert.match(useGameState, /throw new Error\('Failed to fetch public state from Supabase'\)[\s\S]*const system =/)
  assert.match(useGameState, /publicStateError:\s*null[\s\S]*countdown: current\.countdown/)
  assert.match(useGameState, /useGameStateStore\.setState\(\{\s*publicStateError: err\?\.message \|\| 'Failed to fetch public state from Supabase'/)
  assert.match(useGameState, /applyServerState\(publicState\)/)
})

test('public state fetch ignores stale overlapping responses', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /let publicStateFetchRun = 0/)
  assert.match(useGameState, /let publicStateBridgeActive = true/)
  assert.match(useGameState, /const fetchRun = publicStateFetchRun \+ 1/)
  assert.match(useGameState, /publicStateFetchRun = fetchRun/)
  assert.match(useGameState, /if \(!publicStateBridgeActive \|\| fetchRun !== publicStateFetchRun\) return/)
  assert.match(useGameState, /publicStateBridgeActive = false/)
  assert.match(useGameState, /publicStateFetchRun \+= 1/)
  assert.match(useGameState, /triggerFetchPublicState: undefined/)
})

test('active match snapshots expose the effective wager mode for phase transitions', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const battleScreen = readProjectFile('src/screens/BattleScreen.jsx')
  const arenaScreen = readProjectFile('src/screens/ArenaScreen.jsx')
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(useGameState, /isWagerMatch,/)
  assert.match(useGameState, /const effectiveGameState = \{ phase: system\.phase \|\| 'phase1' \}/)
  assert.match(useGameState, /isWager: isWagerMatch\(m, effectiveGameState\)/)
  assert.match(battleScreen, /currentActiveMatch\.isWager \? 'CRITICAL STAKES/)
  assert.match(arenaScreen, /match\.isWager \? 'WAGER' : 'STANDARD'/)
  assert.match(adminScreen, /m\.isWager && <span/)
})

test('login form guards duplicate submits and avoids state writes after unmount', () => {
  const loginScreen = readProjectFile('src/screens/LoginScreen.jsx')

  assert.match(loginScreen, /useRef/)
  assert.match(loginScreen, /const loadingRef = useRef\(false\)/)
  assert.match(loginScreen, /const mountedRef = useRef\(true\)/)
  assert.match(loginScreen, /mountedRef\.current = false/)
  assert.match(loginScreen, /const setLoginLoading = \(isLoading\) => \{/)
  assert.match(loginScreen, /loadingRef\.current = isLoading/)
  assert.match(loginScreen, /if \(mountedRef\.current\) setLoading\(isLoading\)/)
  assert.match(loginScreen, /if \(loadingRef\.current\) return/)
  assert.match(loginScreen, /\} else if \(mountedRef\.current\) \{\s*setError\(result\.error \|\| 'Access Denied'\);?\s*\}/)
  assert.match(loginScreen, /finally \{\s*setLoginLoading\(false\);?\s*\}/)
})
