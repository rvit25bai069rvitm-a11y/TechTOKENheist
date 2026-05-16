import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('public-state edge function returns only event-safe public rows', () => {
  const publicState = readProjectFile('supabase/functions/public-state/index.ts')

  assert.match(publicState, /from\('system'\)\s*\.select\('\*'\)\s*\.eq\('key', 'game'\)/)
  assert.match(publicState, /SAFE_TEAM_COLUMNS/)
  assert.match(publicState, /from\('teams'\)\.select\(SAFE_TEAM_COLUMNS\)/)
  assert.doesNotMatch(publicState, /from\('teams'\)\.select\('\*'\)/)
  assert.match(publicState, /stripPrivateTeamSnapshot/)
  assert.match(publicState, /const \{\s*password[\s\S]*\.\.\.safe\s*\} = team/)
  assert.match(publicState, /matchRows:\s*\(matchesRes\.data \|\| \[\]\)\.map\(sanitizeMatchRow\)/)
})

test('game action edge function does not persist passwords into active match snapshots', () => {
  const gameActions = readProjectFile('supabase/functions/game-actions/index.ts')

  assert.match(gameActions, /const toPublicTeamSnapshot = \(team\) =>/)
  assert.doesNotMatch(gameActions, /teamA:\s*teamA,\s*\n\s*teamB:\s*teamB/)
})
