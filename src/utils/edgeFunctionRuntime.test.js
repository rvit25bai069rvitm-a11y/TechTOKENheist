import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

const getCaseBlock = (source, startCase, endCase) => {
  const start = source.indexOf(startCase)
  const end = source.indexOf(endCase, start)
  assert.notEqual(start, -1, `${startCase} block missing`)
  assert.notEqual(end, -1, `${endCase} block missing`)
  return source.slice(start, end)
}

test('edge game actions do not read sysCheck before it is initialized', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')

  const createTeamBlock = getCaseBlock(edgeFunction, "case 'createTeam':", "case 'editTeam':")
  assert.doesNotMatch(createTeamBlock, /phase:\s*sysCheck\?\./)
  const createTeamQueueInsert = createTeamBlock.match(/from\('matchmaking_queue'\)[\s\S]*?insert\(\[\s*\{[\s\S]*?\}\s*,?\s*\]\)/)?.[0] || ''
  assert.match(createTeamQueueInsert, /team_id:\s*teamId/)
  assert.match(createTeamQueueInsert, /team_name:\s*name/)
  assert.match(createTeamQueueInsert, /team_tokens:\s*payloadData\.tokens \?\? 1/)
  assert.doesNotMatch(createTeamQueueInsert, /\bphase\s*:/)

  const declareWinnerBlock = getCaseBlock(edgeFunction, "case 'declareWinner':", "case 'spinDomain':")
  assert.doesNotMatch(declareWinnerBlock, /phase:\s*sysCheck\?\./)
  assert.match(declareWinnerBlock, /phase:\s*system\?\.phase \|\| 'phase1'/)
})

test('wager phase transition rematches queued teams without clearing active matches', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const togglePhaseBlock = getCaseBlock(edgeFunction, "case 'togglePhase':", "case 'createTeam':")

  assert.doesNotMatch(togglePhaseBlock, /from\('active_matches'\)\.delete/)
  assert.match(togglePhaseBlock, /from\('matchmaking_queue'\)[\s\S]{0,120}\.update\(\{\s*matched_with:\s*null\s*\}\)[\s\S]{0,120}\.not\('matched_with', 'is', null\)/)
  assert.match(togglePhaseBlock, /await autoMatchPairs\(\)/)
})

test('edge automatching passes current phase into largest-difference wager scoring', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const sharedMatchmaking = readProjectFile('supabase/functions/_shared/matchmaking.ts')
  const autoMatchBlock = getCaseBlock(edgeFunction, 'const autoMatchPairs = async () => {', 'serve(async (req) => {')

  assert.match(autoMatchBlock, /const system = await getGameSystem\(\)/)
  assert.match(autoMatchBlock, /gameState:\s*\{\s*phase:\s*system\?\.phase \|\| 'phase1'\s*\}/)
  assert.match(sharedMatchmaking, /function scorePhase2\(teamA, teamB\)[\s\S]*return -Math\.abs\(\(teamA\.tokens \|\| 0\) - \(teamB\.tokens \|\| 0\)\)/)
  assert.match(sharedMatchmaking, /isPhase2[\s\S]{0,160}\? scorePhase2\(eligible\[i\], eligible\[j\]\)/)
})

test('active matches use current wager phase when declaring a winner', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const declareWinnerBlock = getCaseBlock(edgeFunction, "case 'declareWinner':", "case 'spinDomain':")

  assert.match(declareWinnerBlock, /const system = await getGameSystem\(\)/)
  assert.match(declareWinnerBlock, /const isWager = Boolean\(match\?\.is_wager \|\| match\?\.isWager \|\| system\?\.phase === 'phase2'\)/)
  assert.match(declareWinnerBlock, /calculateWagerOutcome\(winnerTeam, loserTeam\)/)
  assert.match(declareWinnerBlock, /reason: isWager \? 'Wager win' : 'Match win'/)
})

test('winner declaration claims the active match before editing guarded team rows', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const declareWinnerBlock = getCaseBlock(edgeFunction, "case 'declareWinner':", "case 'spinDomain':")

  const claimIndex = declareWinnerBlock.indexOf("from('active_matches')")
  const teamUpdateIndex = declareWinnerBlock.indexOf("from('teams').update")
  assert.ok(claimIndex > -1, 'active match claim is missing')
  assert.ok(teamUpdateIndex > -1, 'team update is missing')
  assert.ok(claimIndex < teamUpdateIndex, 'active match must be claimed before guarded team updates')
  assert.match(declareWinnerBlock, /if \(winnerUpdate\.error\) return fail\(500, winnerUpdate\.error\.message\)/)
  assert.match(declareWinnerBlock, /if \(loserUpdate\.error\) return fail\(500, loserUpdate\.error\.message\)/)
})

test('enrollment repairs orphan fighting teams before building the queue', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const repairBlock = getCaseBlock(edgeFunction, 'const releaseOrphanedFightingTeams = async () => {', 'const enrollAllEligibleTeams = async () => {')
  const enrollBlock = getCaseBlock(edgeFunction, 'const enrollAllEligibleTeams = async () => {', 'const autoMatchPairs = async () => {')

  assert.match(repairBlock, /from\('active_matches'\)\.select\('team_a, team_b'\)/)
  assert.match(repairBlock, /from\('matchmaking_queue'\)\.select\('team_id, team_name, team_tokens'\)/)
  assert.match(repairBlock, /const queuedOrphans = orphanedTeams\.filter/)
  assert.match(repairBlock, /tokens: Number\(queueRow\.team_tokens \?\? team\.tokens \?\? 1\)/)
  assert.match(repairBlock, /const unqueuedOrphanIds = orphanedTeams/)
  assert.match(repairBlock, /const unqueuedStatus = system\?\.phase === 'phase2' \? 'eliminated' : 'timeout'/)
  assert.match(enrollBlock, /await releaseOrphanedFightingTeams\(\)/)
})

test('force enrollment action runs the matcher after repairing queue state', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const enrollCaseBlock = getCaseBlock(edgeFunction, "case 'enrollAllEligible':", "case 'startGame':")

  assert.match(enrollCaseBlock, /const pairs = await autoMatchPairs\(\)/)
  assert.match(enrollCaseBlock, /return ok\(\{\s*pairs\s*\}\)/)
  assert.doesNotMatch(enrollCaseBlock, /await enrollAllEligibleTeams\(\);\s*return ok\(\)/)
})

test('admin winner buttons surface declare-winner failures', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /const handleDeclareWinner = \(match, winningTeam\) =>/)
  assert.match(adminScreen, /safeAction\(`declareWinner:\$\{match\.id\}`, \(\) => declareWinner\(match\.id, winningTeam\.id\)\)/)
  assert.doesNotMatch(adminScreen, /onClick=\{\(\) => declareWinner\(m\.id, m\.teamA\.id\)\}/)
  assert.doesNotMatch(adminScreen, /onClick=\{\(\) => declareWinner\(m\.id, m\.teamB\.id\)\}/)
})

test('admin token adjustments keep queued token cache in sync', () => {
  const edgeFunction = readProjectFile('supabase/functions/game-actions/index.ts')
  const updateTokensBlock = getCaseBlock(edgeFunction, "case 'updateTokens':", "case 'recoverFromTimeout':")

  assert.match(updateTokensBlock, /const teamUpdate = await supabaseAdmin\.from\('teams'\)\.update\(updates\)\.eq\('id', teamId\)/)
  assert.match(updateTokensBlock, /if \(teamUpdate\.error\) return fail\(500, teamUpdate\.error\.message\)/)
  assert.match(updateTokensBlock, /from\('matchmaking_queue'\)[\s\S]*\.update\(\{\s*team_tokens:\s*Math\.max\(0, newTokens\),\s*matched_with:\s*null\s*\}\)[\s\S]*\.eq\('team_id', teamId\)/)
})
