import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('battle screen renders queue pair locks from matched_with state', () => {
  const battleScreen = readProjectFile('src/screens/BattleScreen.jsx')

  assert.match(battleScreen, /myQueueEntry/)
  assert.match(battleScreen, /const myMatchedWith = myQueueEntry\?\.matchedWith \|\| myQueueEntry\?\.matched_with \|\| null/)
  assert.match(battleScreen, /if \(myMatchedWith\)/)
  assert.doesNotMatch(battleScreen, /status === 'matched'/)
})

test('player shell counts only valid ready queue pairs', () => {
  const app = readProjectFile('src/App.jsx')

  assert.match(app, /import \{ buildReadyQueuePairs \} from '\.\/utils\/matchmaking'/)
  assert.match(app, /const readyPairs = buildReadyQueuePairs\(\{/)
  assert.match(app, /matchConstraints/)
  assert.doesNotMatch(app, /buildQueuePairsFromEntries\(matchmakingQueue\)\.length/)
})

test('queue diagnostics receive active match context', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')
  const arenaScreen = readProjectFile('src/screens/ArenaScreen.jsx')

  assert.match(adminScreen, /buildQueueDiagnostics\(\{\s*gameState,\s*teams,\s*matchmakingQueue,\s*matchConstraints,\s*activeMatches\s*\}\)/)
  assert.match(arenaScreen, /buildQueueDiagnostics\(\{\s*gameState,\s*teams,\s*matchmakingQueue,\s*matchConstraints,\s*activeMatches\s*\}\)/)
})

test('admin force assignment button invokes automatching', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /autoMatchPairs/)
  assert.match(adminScreen, /onClick=\{\(\) => safeAction\('autoMatchPairs', autoMatchPairs\)\}/)
  assert.doesNotMatch(adminScreen, /onClick=\{enrollAllEligible\}/)
})

test('admin confirms wheel-selected domain before creating a match', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /pendingDomainConfirm/)
  assert.match(adminScreen, /const handleQueueDomainSpin = \(pair, domain\) =>/)
  assert.match(adminScreen, /setPendingDomainConfirm\(\{\s*pair,\s*domain\s*\}\)/)
  assert.match(adminScreen, /value=\{pendingDomainConfirm\.domain\}/)
  assert.match(adminScreen, /onChange=\{\(e\) => setPendingDomainConfirm\(\(current\) => \(\{\s*\.\.\.current,\s*domain: e\.target\.value\s*\}\)\)\}/)
  assert.match(adminScreen, /CONTINUE TO VAULTS/)
  assert.match(adminScreen, /safeAction\(`createMatch:\$\{pair\.teamAId\}:\$\{pair\.teamBId\}`, async \(\) => \{[\s\S]*createMatch\(pair\.teamAId, pair\.teamBId, domain\)/)
  assert.doesNotMatch(adminScreen, /onSpin=\{\(domain\) => createMatch\(pair\.teamAId, pair\.teamBId, domain\)\}/)
})

test('admin delete team action uses confirmation modal', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /const handleDeleteTeam = \(team\) =>/)
  assert.match(adminScreen, /title: 'DELETE PROFILE'/)
  assert.match(adminScreen, /onConfirm: \(\) => safeAction\(`deleteTeam:\$\{team\.id\}`, \(\) => deleteTeam\(team\.id\)\)/)
  assert.match(adminScreen, /onClick=\{\(\) => handleDeleteTeam\(t\)\}/)
  assert.doesNotMatch(adminScreen, /onClick=\{\(\) => deleteTeam\(t\.id\)\}/)
})
