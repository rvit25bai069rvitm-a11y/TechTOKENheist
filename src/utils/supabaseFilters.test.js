import assert from 'node:assert/strict'
import test from 'node:test'

import { assertSafeUuid, buildActiveMatchTeamFilter } from './supabaseFilters.js'

test('buildActiveMatchTeamFilter creates raw PostgREST OR syntax only from UUID ids', () => {
  const firstId = '00000000-0000-4000-8000-000000000001'
  const secondId = '00000000-0000-4000-8000-000000000002'

  assert.equal(
    buildActiveMatchTeamFilter(firstId, secondId),
    [
      `team_a.eq.${firstId}`,
      `team_b.eq.${firstId}`,
      `team_a.eq.${secondId}`,
      `team_b.eq.${secondId}`,
    ].join(',')
  )
})

test('buildActiveMatchTeamFilter deduplicates team ids before building OR filters', () => {
  const teamId = '00000000-0000-4000-8000-000000000001'

  assert.equal(
    buildActiveMatchTeamFilter(teamId, teamId),
    [`team_a.eq.${teamId}`, `team_b.eq.${teamId}`].join(',')
  )
})

test('assertSafeUuid rejects raw PostgREST filter fragments', () => {
  assert.equal(
    assertSafeUuid('00000000-0000-4000-8000-000000000001', 'team id'),
    '00000000-0000-4000-8000-000000000001'
  )

  assert.throws(
    () => assertSafeUuid('00000000-0000-4000-8000-000000000001,team_b.not.is.null', 'team id'),
    /Invalid team id/
  )
  assert.throws(() => assertSafeUuid('', 'team id'), /Invalid team id/)
  assert.throws(() => assertSafeUuid('configured-smoke-team', 'team id'), /Invalid team id/)
})
