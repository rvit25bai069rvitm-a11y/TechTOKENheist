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
