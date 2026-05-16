import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getQueueBlockReasons,
  getValidDomains,
  runMatchmaking,
} from '../src/utils/matchmaking.js'

test('wager mode allows opponents who reached the phase 1 repeat limit', () => {
  const teamA = { id: 'a', name: 'A', tokens: 1, status: 'idle' }
  const teamB = { id: 'b', name: 'B', tokens: 9, status: 'idle' }
  const reasons = getQueueBlockReasons({
    gameState: { phase: 'phase2' },
    teamA,
    teamB,
    matchConstraints: {
      a: { opponents: { b: 2 }, lastOpponent: 'c' },
      b: { opponents: { a: 2 }, lastOpponent: 'd' },
    },
  })

  assert.deepEqual(reasons, [])
})

test('wager mode keeps only consecutive-domain blocking for domain choices', () => {
  const teamA = { id: 'a', name: 'A', tokens: 1, status: 'idle' }
  const teamB = { id: 'b', name: 'B', tokens: 9, status: 'idle' }
  const valid = getValidDomains({
    teamA,
    teamB,
    allDomains: ['Tech Pitch', 'Tech Quiz'],
    matchConstraints: {
      a: {
        domains: { 'Tech Pitch': 2, 'Tech Quiz': 2 },
        combos: { 'b::Tech Pitch': 1, 'b::Tech Quiz': 1 },
        lastDomain: 'Tech Quiz',
      },
      b: {
        domains: { 'Tech Pitch': 2, 'Tech Quiz': 2 },
        combos: { 'a::Tech Pitch': 1, 'a::Tech Quiz': 1 },
        lastDomain: 'Tech Quiz',
      },
    },
    phase: 'phase2',
  })

  assert.deepEqual(valid, ['Tech Pitch'])
})

test('wager mode prioritizes the largest token difference first', () => {
  const pairs = runMatchmaking({
    gameState: { phase: 'phase2' },
    teams: [
      { id: 'low', name: 'Low', tokens: 1, status: 'idle' },
      { id: 'high', name: 'High', tokens: 12, status: 'idle' },
      { id: 'midA', name: 'Mid A', tokens: 5, status: 'idle' },
      { id: 'midB', name: 'Mid B', tokens: 6, status: 'idle' },
    ],
    matchConstraints: {},
    existingMatches: [],
  })

  assert.deepEqual(pairs[0], {
    teamAId: 'low',
    teamAName: 'Low',
    teamBId: 'high',
    teamBName: 'High',
  })
})
