import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMatchHistoryEntry,
  buildQueueRowsForEligibleTeams,
  buildTeamRuntimeReset,
  normalizeMatchHistoryRows,
} from './gameRecords.js'

test('buildMatchHistoryEntry lets Supabase generate the primary key', () => {
  const entry = buildMatchHistoryEntry({
    winnerId: 'team-alpha',
    loserId: 'team-bravo',
    winnerName: 'Alpha',
    loserName: 'Bravo',
    domain: 'Tech Quiz',
    isWager: true,
    timestamp: '10:15:00 AM',
  })

  assert.deepEqual(entry, {
    winner_id: 'team-alpha',
    loser_id: 'team-bravo',
    winner: 'Alpha',
    loser: 'Bravo',
    domain: 'Tech Quiz',
    timestamp: '10:15:00 AM',
    is_wager: true,
  })
  assert.equal(Object.hasOwn(entry, 'id'), false)
})

test('buildQueueRowsForEligibleTeams re-enrolls only idle teams with tokens', () => {
  const rows = buildQueueRowsForEligibleTeams([
    { id: 'winner', name: 'Winner', tokens: 3, status: 'idle' },
    { id: 'loser-timeout', name: 'Timeout', tokens: 0, status: 'timeout' },
    { id: 'loser-eliminated', name: 'Out', tokens: 0, status: 'eliminated' },
    { id: 'busy', name: 'Busy', tokens: 2, status: 'fighting' },
  ])

  assert.deepEqual(rows, [
    { team_id: 'winner', team_name: 'Winner', team_tokens: 3 },
  ])
})

test('normalizeMatchHistoryRows resolves current team names by stored ids', () => {
  const rows = normalizeMatchHistoryRows([
    {
      winner_id: 'team-alpha',
      loser_id: 'team-bravo',
      winner: 'Old Alpha',
      loser: 'Old Bravo',
      is_wager: true,
    },
    {
      winner: 'Legacy Winner',
      loser: 'Legacy Loser',
      is_wager: false,
    },
  ], [
    { id: 'team-alpha', name: 'Alpha Prime' },
    { id: 'team-bravo', name: 'Bravo Prime' },
  ])

  assert.deepEqual(rows, [
    {
      winner_id: 'team-alpha',
      loser_id: 'team-bravo',
      winner: 'Alpha Prime',
      loser: 'Bravo Prime',
      is_wager: true,
      isWager: true,
    },
    {
      winner: 'Legacy Winner',
      loser: 'Legacy Loser',
      is_wager: false,
      isWager: false,
    },
  ])
})

test('buildTeamRuntimeReset preserves credentials and roster fields', () => {
  const payload = buildTeamRuntimeReset()

  assert.deepEqual(payload, {
    tokens: 1,
    status: 'idle',
    timeout_until: null,
    last_token_update_time: null,
  })
  assert.equal(Object.hasOwn(payload, 'password'), false)
  assert.equal(Object.hasOwn(payload, 'member_names'), false)
  assert.equal(Object.hasOwn(payload, 'leader'), false)
})
