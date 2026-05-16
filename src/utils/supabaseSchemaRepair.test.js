import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('Supabase SQL repairs existing queue team_id uniqueness for upserts', () => {
  const sql = readProjectFile('server/supabase_policies.sql')

  assert.match(sql, /row_number\(\) over \([\s\S]*partition by team_id[\s\S]*duplicate_rank/)
  assert.match(sql, /delete from public\.matchmaking_queue[\s\S]*duplicate_rank > 1/)
  assert.match(sql, /add constraint matchmaking_queue_team_id_key unique \(team_id\)/)
  assert.match(sql, /pg_constraint[\s\S]*matchmaking_queue[\s\S]*team_id/)
})
