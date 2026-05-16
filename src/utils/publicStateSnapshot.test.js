import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPublicStateSnapshot } from './publicStateSnapshot.js'

const makeTeams = (count) => Array.from({ length: count }, (_, index) => ({
  id: `team-${index}`,
  name: `Team ${String(index).padStart(2, '0')}`,
  member_names: [`Leader ${index}`, `Member ${index}`],
  leader: `Leader ${index}`,
  password: `secret-${index}`,
  tokens: (index % 5) + 1,
  status: 'idle',
  last_token_update_time: String(1_777_000_000_000 + index),
}))

test('public state snapshot handles 35 teams without leaking credentials', () => {
  const snapshot = buildPublicStateSnapshot({
    systemRows: [
      { key: 'admin_credential', status: 'credential-row' },
      { key: 'game', status: 'active', is_game_active: true, is_paused: false, phase: 'phase1', domains: ['Tech Quiz'] },
    ],
    teamsRows: makeTeams(35),
    queueRows: [
      { team_id: 'team-0', team_name: 'Team 00', team_tokens: 1, matched_with: 'team-1' },
      { team_id: 'team-1', team_name: 'Team 01', team_tokens: 2, matched_with: 'team-0' },
    ],
    matchRows: [{
      id: 'match-1',
      team_a: 'team-0',
      team_b: 'team-1',
      domain: 'Tech Quiz',
      start_time: '1777000000000',
      teamA: { id: 'team-0', name: 'Team 00', tokens: 1, status: 'idle', password: 'embedded-a' },
      teamB: { id: 'team-1', name: 'Team 01', tokens: 2, status: 'idle', password: 'embedded-b' },
    }],
    historyRows: [],
    notificationRows: [],
    tokenHistory: [],
  })

  assert.equal(snapshot.gameState.status, 'active')
  assert.equal(snapshot.gameState.isGameActive, true)
  assert.equal(snapshot.teams.length, 35)
  assert.equal(snapshot.matchmakingQueue.length, 2)
  assert.equal(snapshot.activeMatches.length, 1)
  assert.equal(Object.hasOwn(snapshot.teams[0], 'password'), false)
  assert.equal(Object.hasOwn(snapshot.activeMatches[0].teamA, 'password'), false)
  assert.equal(Object.hasOwn(snapshot.activeMatches[0].teamB, 'password'), false)
})

test('public state snapshot releases queued orphan fighters from stale fighting status', () => {
  const snapshot = buildPublicStateSnapshot({
    systemRows: [
      { key: 'game', status: 'active', is_game_active: true, is_paused: false, phase: 'phase1' },
    ],
    teamsRows: [
      { id: 'team-a', name: 'Hakuna', member_names: ['Leader A'], tokens: 1, status: 'fighting' },
      { id: 'team-b', name: 'Helsinki', member_names: ['Leader B'], tokens: 1, status: 'fighting' },
      { id: 'team-c', name: 'Active One', member_names: ['Leader C'], tokens: 3, status: 'fighting' },
      { id: 'team-d', name: 'Active Two', member_names: ['Leader D'], tokens: 2, status: 'fighting' },
    ],
    queueRows: [
      { team_id: 'team-a', team_name: 'Hakuna', team_tokens: 2, matched_with: null },
      { team_id: 'team-b', team_name: 'Helsinki', team_tokens: 2, matched_with: null },
    ],
    matchRows: [
      { id: 'match-1', team_a: 'team-c', team_b: 'team-d', domain: 'Tech Quiz', start_time: 1_777_000_000_000 },
    ],
  })

  const hakuna = snapshot.teams.find((team) => team.id === 'team-a')
  const helsinki = snapshot.teams.find((team) => team.id === 'team-b')
  const activeOne = snapshot.teams.find((team) => team.id === 'team-c')

  assert.equal(hakuna.status, 'idle')
  assert.equal(hakuna.tokens, 2)
  assert.equal(helsinki.status, 'idle')
  assert.equal(helsinki.tokens, 2)
  assert.equal(activeOne.status, 'fighting')
  assert.equal(snapshot.activeMatches[0].teamA.status, 'fighting')
})
