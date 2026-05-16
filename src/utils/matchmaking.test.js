import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildConstraintsFromHistory,
  buildQueuePairsFromEntries,
  buildQueueDiagnostics,
  buildReadyQueuePairs,
  calculateMatchOutcome,
  chooseDomainForMatch,
  findInvalidMatchedQueueTeamIds,
  findStaleMatchedQueueTeamIds,
  getQueueBlockReasons,
  getTimeoutDuration,
  getValidDomains,
  isWagerMatch,
  normalizeTimeoutOverrideMs,
  runMatchmaking,
  sanitizeConfiguredDomains,
  timeoutMinutesToMs,
} from './matchmaking.js'

const createDeterministicRandom = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const randomInt = (rng, maxExclusive) => Math.floor(rng() * maxExclusive)

test('runMatchmaking prioritizes closest token pairs in phase 1', () => {
  const pairs = runMatchmaking({
    gameState: { phase: 'phase1' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
      { id: 'bravo', name: 'Bravo', tokens: 1, status: 'idle' },
      { id: 'charlie', name: 'Charlie', tokens: 3, status: 'idle' },
      { id: 'delta', name: 'Delta', tokens: 5, status: 'idle' },
    ],
    matchConstraints: {},
    existingMatches: [],
  })

  assert.deepEqual(pairs, [
    { teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'bravo', teamBName: 'Bravo' },
    { teamAId: 'charlie', teamAName: 'Charlie', teamBId: 'delta', teamBName: 'Delta' },
  ])
})

test('runMatchmaking preserves maximum pair count before applying phase priority', () => {
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 1, status: 'idle' },
    { id: 'charlie', name: 'Charlie', tokens: 2, status: 'idle' },
    { id: 'delta', name: 'Delta', tokens: 2, status: 'idle' },
  ]
  const matchConstraints = {
    charlie: {
      opponents: {},
      domains: {},
      combos: {
        'delta::Tech Pitch': 1,
        'delta::Tech Quiz': 1,
      },
      lastOpponent: null,
      lastDomain: null,
    },
    delta: {
      opponents: {},
      domains: {},
      combos: {
        'charlie::Tech Pitch': 1,
        'charlie::Tech Quiz': 1,
      },
      lastOpponent: null,
      lastDomain: null,
    },
  }

  const pairs = runMatchmaking({
    gameState: { phase: 'phase1', domains: ['Tech Pitch', 'Tech Quiz'] },
    teams,
    matchConstraints,
    existingMatches: [],
  })

  assert.deepEqual(pairs, [
    { teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'charlie', teamBName: 'Charlie' },
    { teamAId: 'bravo', teamAName: 'Bravo', teamBId: 'delta', teamBName: 'Delta' },
  ])
})

test('runMatchmaking prioritizes largest token gaps in phase 2', () => {
  const pairs = runMatchmaking({
    gameState: { phase: 'phase2' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
      { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
      { id: 'charlie', name: 'Charlie', tokens: 7, status: 'idle' },
      { id: 'delta', name: 'Delta', tokens: 9, status: 'idle' },
    ],
    matchConstraints: {},
    existingMatches: [],
  })

  assert.deepEqual(pairs, [
    { teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'delta', teamBName: 'Delta' },
    { teamAId: 'bravo', teamAName: 'Bravo', teamBId: 'charlie', teamBName: 'Charlie' },
  ])
})

test('phase 2 queued matchmaking excludes active matches and uses largest token differences', () => {
  const pairs = runMatchmaking({
    gameState: { phase: 'phase2' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
      { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
      { id: 'charlie', name: 'Charlie', tokens: 7, status: 'idle' },
      { id: 'delta', name: 'Delta', tokens: 10, status: 'idle' },
      { id: 'echo', name: 'Echo', tokens: 6, status: 'idle' },
      { id: 'foxtrot', name: 'Foxtrot', tokens: 9, status: 'idle' },
    ],
    matchConstraints: {},
    existingMatches: [{ team_a: 'charlie', team_b: 'foxtrot' }],
  })

  assert.deepEqual(pairs, [
    { teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'delta', teamBName: 'Delta' },
    { teamAId: 'bravo', teamAName: 'Bravo', teamBId: 'echo', teamBName: 'Echo' },
  ])
})

test('phase 2 still enforces opponent and domain allocation safety', () => {
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 10, status: 'idle' },
    { id: 'charlie', name: 'Charlie', tokens: 6, status: 'idle' },
  ]
  const matchConstraints = {
    alpha: {
      opponents: { bravo: 2 },
      domains: { 'Tech Pitch': 2, 'Tech Quiz': 2 },
      combos: { 'bravo::Tech Pitch': 1, 'bravo::Tech Quiz': 1 },
      lastOpponent: 'bravo',
      lastDomain: 'Tech Pitch',
    },
    bravo: {
      opponents: { alpha: 2 },
      domains: { 'Tech Pitch': 2, 'Tech Quiz': 2 },
      combos: { 'alpha::Tech Pitch': 1, 'alpha::Tech Quiz': 1 },
      lastOpponent: 'alpha',
      lastDomain: 'Tech Pitch',
    },
  }

  const gameState = { phase: 'phase2', domains: ['Tech Pitch', 'Tech Quiz'] }

  assert.deepEqual(
    getQueueBlockReasons({ gameState, teamA: teams[0], teamB: teams[1], matchConstraints }),
    [
      'Already faced each other 2 times (max reached)',
      'Cannot face the same opponent in consecutive matches',
      'No valid domains available for this pair',
    ]
  )
  assert.deepEqual(
    getValidDomains({ teamA: teams[0], teamB: teams[1], matchConstraints, allDomains: gameState.domains, phase: 'phase2' }),
    []
  )
  assert.deepEqual(
    runMatchmaking({ gameState, teams, matchConstraints, existingMatches: [] }),
    []
  )
})

test('phase 2 blocks a pair when every safe configured domain repeats consecutively', () => {
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 10, status: 'idle' },
  ]
  const matchConstraints = {
    alpha: { opponents: {}, domains: {}, combos: {}, lastOpponent: null, lastDomain: 'Tech Pitch' },
    bravo: { opponents: {}, domains: {}, combos: {}, lastOpponent: null, lastDomain: 'Tech Quiz' },
  }
  const gameState = { phase: 'phase2', domains: ['Tech Pitch', 'Tech Quiz'] }

  assert.deepEqual(
    getQueueBlockReasons({ gameState, teamA: teams[0], teamB: teams[1], matchConstraints }),
    ['No valid domains available for this pair']
  )
  assert.deepEqual(runMatchmaking({ gameState, teams, matchConstraints, existingMatches: [] }), [])
})

test('runMatchmaking blocks repeat opponents and active-match teams', () => {
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 2, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
    { id: 'charlie', name: 'Charlie', tokens: 2, status: 'idle' },
  ]
  const matchConstraints = buildConstraintsFromHistory([
    { winner: 'Alpha', loser: 'Bravo', domain: 'Tech Pitch', created_at: '2026-01-01T00:00:00Z' },
    { winner: 'Bravo', loser: 'Alpha', domain: 'Tech Quiz', created_at: '2026-01-02T00:00:00Z' },
  ], teams)

  const pairs = runMatchmaking({
    gameState: { phase: 'phase1' },
    teams,
    matchConstraints,
    existingMatches: [{ team_a: 'charlie', team_b: 'other' }],
  })

  assert.deepEqual(pairs, [])
})

test('buildConstraintsFromHistory uses stored team ids when names change', () => {
  const constraints = buildConstraintsFromHistory([
    {
      winner: 'Old Alpha',
      loser: 'Old Bravo',
      winner_id: 'alpha',
      loser_id: 'bravo',
      domain: 'Tech Pitch',
      created_at: '2026-01-01T00:00:00Z',
    },
  ], [
    { id: 'alpha', name: 'Alpha' },
    { id: 'bravo', name: 'Bravo' },
  ])

  assert.equal(constraints.alpha.opponents.bravo, 1)
  assert.equal(constraints.bravo.opponents.alpha, 1)
  assert.equal(constraints.alpha.combos['bravo::Tech Pitch'], 1)
})

test('buildConstraintsFromHistory prefers stored ids over stale names that now belong to another team', () => {
  const constraints = buildConstraintsFromHistory([
    {
      winner: 'Old Alpha',
      loser: 'Old Bravo',
      winner_id: 'alpha',
      loser_id: 'bravo',
      domain: 'Tech Pitch',
      created_at: '2026-01-01T00:00:00Z',
    },
  ], [
    { id: 'alpha', name: 'Renamed Alpha' },
    { id: 'bravo', name: 'Renamed Bravo' },
    { id: 'charlie', name: 'Old Alpha' },
  ])

  assert.equal(constraints.alpha.opponents.bravo, 1)
  assert.equal(constraints.bravo.opponents.alpha, 1)
  assert.equal(constraints.charlie, undefined)
})

test('runMatchmaking blocks pairs with no valid domain left', () => {
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 2, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
  ]
  const matchConstraints = {
    alpha: {
      opponents: {},
      domains: { 'Tech Pitch': 1, 'Tech Quiz': 1 },
      combos: { 'bravo::Tech Pitch': 1, 'bravo::Tech Quiz': 1 },
      lastOpponent: null,
      lastDomain: null,
    },
    bravo: {
      opponents: {},
      domains: { 'Tech Pitch': 1, 'Tech Quiz': 1 },
      combos: { 'alpha::Tech Pitch': 1, 'alpha::Tech Quiz': 1 },
      lastOpponent: null,
      lastDomain: null,
    },
  }

  const blockReasons = getQueueBlockReasons({
    gameState: { phase: 'phase1', domains: ['Tech Pitch', 'Tech Quiz'] },
    teamA: teams[0],
    teamB: teams[1],
    matchConstraints,
  })

  const pairs = runMatchmaking({
    gameState: { phase: 'phase1', domains: ['Tech Pitch', 'Tech Quiz'] },
    teams,
    matchConstraints,
    existingMatches: [],
  })

  assert.deepEqual(blockReasons, ['No valid domains available for this pair'])
  assert.deepEqual(pairs, [])
})

test('runMatchmaking excludes stale zero-token teams from new pairs', () => {
  const pairs = runMatchmaking({
    gameState: { isGameActive: true, isPaused: false, phase: 'phase1' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 0, status: 'idle' },
      { id: 'bravo', name: 'Bravo', tokens: 1, status: 'idle' },
    ],
    matchConstraints: {},
    existingMatches: [],
  })

  assert.deepEqual(pairs, [])
})

test('runMatchmaking only considers idle or queued teams', () => {
  const pairs = runMatchmaking({
    gameState: { phase: 'phase1' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 1, status: 'ready' },
      { id: 'bravo', name: 'Bravo', tokens: 1, status: 'idle' },
      { id: 'charlie', name: 'Charlie', tokens: 1, status: 'queued' },
    ],
    matchConstraints: {},
    existingMatches: [],
  })

  assert.deepEqual(pairs, [
    { teamAId: 'bravo', teamAName: 'Bravo', teamBId: 'charlie', teamBName: 'Charlie' },
  ])
})

test('runMatchmaking randomized invariant sweep returns only valid disjoint pairs', () => {
  const statuses = ['idle', 'queued', 'fighting', 'timeout', 'eliminated', 'ready']
  const domains = ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev']

  for (let scenario = 0; scenario < 160; scenario += 1) {
    const rng = createDeterministicRandom(0xdecafbad + scenario)
    const teams = Array.from({ length: 9 }, (_, index) => ({
      id: `team-${scenario}-${index}`,
      name: `Team ${scenario}-${index}`,
      tokens: randomInt(rng, 8),
      status: statuses[randomInt(rng, statuses.length)],
    }))
    const gameState = {
      phase: scenario % 2 === 0 ? 'phase1' : 'phase2',
      domains,
    }
    const existingMatches = []
    const activeTeamIds = new Set()

    for (let index = 0; index < teams.length - 1; index += 2) {
      if (rng() >= 0.18 || activeTeamIds.has(teams[index].id) || activeTeamIds.has(teams[index + 1].id)) continue
      existingMatches.push({ team_a: teams[index].id, team_b: teams[index + 1].id })
      activeTeamIds.add(teams[index].id)
      activeTeamIds.add(teams[index + 1].id)
    }

    const matchConstraints = Object.fromEntries(teams.map((team) => {
      const opponents = {}
      const domainCounts = {}
      const combos = {}
      const lastDomain = rng() < 0.35 ? domains[randomInt(rng, domains.length)] : null
      const lastOpponent = rng() < 0.25 ? teams[randomInt(rng, teams.length)].id : null

      for (const other of teams) {
        if (other.id === team.id) continue
        if (rng() < 0.1) opponents[other.id] = 2
        for (const domain of domains) {
          if (rng() < 0.08) combos[`${other.id}::${domain}`] = 1
        }
      }

      for (const domain of domains) {
        if (rng() < 0.12) domainCounts[domain] = 2
      }

      return [team.id, {
        opponents,
        domains: domainCounts,
        combos,
        lastOpponent,
        lastDomain,
      }]
    }))

    const pairs = runMatchmaking({
      gameState,
      teams,
      matchConstraints,
      existingMatches,
    })
    const teamsById = new Map(teams.map((team) => [team.id, team]))
    const usedTeamIds = new Set()

    for (const pair of pairs) {
      const teamA = teamsById.get(pair.teamAId)
      const teamB = teamsById.get(pair.teamBId)

      assert.ok(teamA, `scenario ${scenario}: pair references missing teamA ${pair.teamAId}`)
      assert.ok(teamB, `scenario ${scenario}: pair references missing teamB ${pair.teamBId}`)
      assert.notEqual(pair.teamAId, pair.teamBId, `scenario ${scenario}: team matched with itself`)
      assert.equal(usedTeamIds.has(pair.teamAId), false, `scenario ${scenario}: ${pair.teamAId} used twice`)
      assert.equal(usedTeamIds.has(pair.teamBId), false, `scenario ${scenario}: ${pair.teamBId} used twice`)
      usedTeamIds.add(pair.teamAId)
      usedTeamIds.add(pair.teamBId)
      assert.ok(
        ['idle', 'queued'].includes(teamA.status || 'idle') || (teamA.status === 'fighting' && !activeTeamIds.has(teamA.id)),
        `scenario ${scenario}: ineligible teamA status ${teamA.status}`
      )
      assert.ok(
        ['idle', 'queued'].includes(teamB.status || 'idle') || (teamB.status === 'fighting' && !activeTeamIds.has(teamB.id)),
        `scenario ${scenario}: ineligible teamB status ${teamB.status}`
      )
      assert.ok((teamA.tokens ?? 0) > 0, `scenario ${scenario}: teamA has no tokens`)
      assert.ok((teamB.tokens ?? 0) > 0, `scenario ${scenario}: teamB has no tokens`)
      assert.equal(activeTeamIds.has(pair.teamAId), false, `scenario ${scenario}: teamA already active`)
      assert.equal(activeTeamIds.has(pair.teamBId), false, `scenario ${scenario}: teamB already active`)
      assert.deepEqual(
        getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints, activeTeamIds }),
        [],
        `scenario ${scenario}: returned pair has block reasons`
      )
    }
  }
})

test('runMatchmaking handles a 35-team event queue without duplicate assignments', () => {
  const teams = Array.from({ length: 35 }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${String(index + 1).padStart(2, '0')}`,
    tokens: (index % 4) + 1,
    status: 'queued',
  }))

  const startedAt = performance.now()
  const pairs = runMatchmaking({
    gameState: {
      phase: 'phase1',
      domains: ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'],
    },
    teams,
    matchConstraints: {},
    existingMatches: [],
  })
  const elapsedMs = performance.now() - startedAt
  const assignedTeamIds = new Set()

  assert.equal(pairs.length, 17)
  assert.ok(elapsedMs < 500, `35-team matchmaking took ${elapsedMs.toFixed(1)}ms`)

  for (const pair of pairs) {
    assert.notEqual(pair.teamAId, pair.teamBId)
    assert.equal(assignedTeamIds.has(pair.teamAId), false, `${pair.teamAId} assigned twice`)
    assert.equal(assignedTeamIds.has(pair.teamBId), false, `${pair.teamBId} assigned twice`)
    assignedTeamIds.add(pair.teamAId)
    assignedTeamIds.add(pair.teamBId)
  }
})

test('queue pairs require reciprocal matched_with rows and report stale links', () => {
  const matchmakingQueue = [
    { team_id: 'alpha', team_name: 'Alpha', matched_with: 'bravo' },
    { team_id: 'bravo', team_name: 'Bravo', matched_with: 'alpha' },
    { team_id: 'selfie', team_name: 'Selfie', matched_with: 'selfie' },
    { team_id: 'charlie', team_name: 'Charlie', matched_with: 'missing' },
    { team_id: 'delta', team_name: 'Delta', matched_with: null },
    { team_id: 'echo', team_name: 'Echo', matched_with: 'foxtrot' },
    { team_id: 'foxtrot', team_name: 'Foxtrot', matched_with: null },
  ]

  assert.deepEqual(buildQueuePairsFromEntries(matchmakingQueue), [
    { teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'bravo', teamBName: 'Bravo' },
  ])
  assert.deepEqual(findStaleMatchedQueueTeamIds(matchmakingQueue).sort(), ['charlie', 'echo', 'selfie'])
})

test('ready queue pairs exclude reciprocal locks that became invalid after state changes', () => {
  const matchmakingQueue = [
    { team_id: 'alpha', team_name: 'Alpha', matched_with: 'bravo' },
    { team_id: 'bravo', team_name: 'Bravo', matched_with: 'alpha' },
    { team_id: 'charlie', team_name: 'Charlie', matched_with: 'delta' },
    { team_id: 'delta', team_name: 'Delta', matched_with: 'charlie' },
    { team_id: 'echo', team_name: 'Echo', matched_with: 'foxtrot' },
    { team_id: 'foxtrot', team_name: 'Foxtrot', matched_with: 'echo' },
  ]
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 2, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
    { id: 'charlie', name: 'Charlie', tokens: 2, status: 'fighting' },
    { id: 'delta', name: 'Delta', tokens: 2, status: 'idle' },
    { id: 'echo', name: 'Echo', tokens: 0, status: 'idle' },
    { id: 'foxtrot', name: 'Foxtrot', tokens: 2, status: 'idle' },
  ]

  assert.deepEqual(
    findInvalidMatchedQueueTeamIds({
      matchmakingQueue,
      teams,
      activeMatches: [{ team_a: 'charlie', team_b: 'delta' }],
      gameState: { phase: 'phase1' },
      matchConstraints: {},
    }).sort(),
    ['charlie', 'delta', 'echo', 'foxtrot']
  )

  assert.deepEqual(
    buildReadyQueuePairs({
      matchmakingQueue,
      teams,
      activeMatches: [{ team_a: 'charlie', team_b: 'delta' }],
      gameState: { phase: 'phase1' },
      matchConstraints: {},
    }),
    [{ teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'bravo', teamBName: 'Bravo' }]
  )
})

test('ready queue pairs exclude locked pairs that are now blocked by match constraints', () => {
  const matchmakingQueue = [
    { team_id: 'alpha', team_name: 'Alpha', matched_with: 'bravo' },
    { team_id: 'bravo', team_name: 'Bravo', matched_with: 'alpha' },
  ]
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 2, status: 'idle' },
    { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
  ]
  const matchConstraints = {
    alpha: { opponents: { bravo: 2 }, domains: {}, combos: {}, lastOpponent: null, lastDomain: null },
    bravo: { opponents: { alpha: 2 }, domains: {}, combos: {}, lastOpponent: null, lastDomain: null },
  }

  assert.deepEqual(
    findInvalidMatchedQueueTeamIds({
      matchmakingQueue,
      teams,
      activeMatches: [],
      gameState: { phase: 'phase1' },
      matchConstraints,
    }).sort(),
    ['alpha', 'bravo']
  )

  assert.deepEqual(
    buildReadyQueuePairs({
      matchmakingQueue,
      teams,
      activeMatches: [],
      gameState: { phase: 'phase1' },
      matchConstraints,
    }),
    []
  )
})

test('stale fighting status without an active match does not block queued teams', () => {
  const matchmakingQueue = [
    { team_id: 'alpha', team_name: 'Alpha', team_tokens: 2, matched_with: 'bravo' },
    { team_id: 'bravo', team_name: 'Bravo', team_tokens: 2, matched_with: 'alpha' },
  ]
  const waitingQueue = matchmakingQueue.map((entry) => ({ ...entry, matched_with: null }))
  const teams = [
    { id: 'alpha', name: 'Alpha', tokens: 2, status: 'fighting' },
    { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
  ]

  assert.deepEqual(
    buildReadyQueuePairs({
      matchmakingQueue,
      teams,
      activeMatches: [],
      gameState: { phase: 'phase1' },
      matchConstraints: {},
    }),
    [{ teamAId: 'alpha', teamAName: 'Alpha', teamBId: 'bravo', teamBName: 'Bravo' }]
  )

  const diagnostics = buildQueueDiagnostics({
    gameState: { phase: 'phase1' },
    teams,
    matchmakingQueue: waitingQueue,
    matchConstraints: {},
    activeMatches: [],
  })

  const alphaDiagnostics = diagnostics.find((entry) => entry.teamId === 'alpha')
  assert.equal(alphaDiagnostics.hasAnyPossibleMatch, true)
  assert.equal(alphaDiagnostics.blockers[0].canMatchNow, true)
  assert.doesNotMatch(alphaDiagnostics.blockers[0].reasons.join('\n'), /not eligible while fighting/)
})

test('active fighting teams remain blocked while their match exists', () => {
  const diagnostics = buildQueueDiagnostics({
    gameState: { phase: 'phase1' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 2, status: 'fighting' },
      { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
    ],
    matchmakingQueue: [
      { team_id: 'alpha', team_name: 'Alpha', team_tokens: 2, matched_with: null },
      { team_id: 'bravo', team_name: 'Bravo', team_tokens: 2, matched_with: null },
    ],
    matchConstraints: {},
    activeMatches: [{ team_a: 'alpha', team_b: 'charlie' }],
  })

  const alphaDiagnostics = diagnostics.find((entry) => entry.teamId === 'alpha')
  assert.equal(alphaDiagnostics.hasAnyPossibleMatch, false)
  assert.match(alphaDiagnostics.blockers[0].reasons.join('\n'), /Alpha is not eligible while fighting/)
})

test('buildQueueDiagnostics accepts raw Supabase snake_case queue rows', () => {
  const diagnostics = buildQueueDiagnostics({
    gameState: { phase: 'phase1' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
      { id: 'bravo', name: 'Bravo', tokens: 2, status: 'idle' },
    ],
    matchmakingQueue: [
      { team_id: 'alpha', team_name: 'Alpha', team_tokens: 1, matched_with: null },
      { team_id: 'bravo', team_name: 'Bravo', team_tokens: 2, matched_with: null },
    ],
    matchConstraints: {},
  })

  assert.equal(diagnostics.length, 2)
  assert.equal(diagnostics[0].teamId, 'alpha')
  assert.equal(diagnostics[0].blockers[0].teamId, 'bravo')
  assert.equal(diagnostics[0].blockers[0].canMatchNow, true)
})

test('buildQueueDiagnostics marks stale ineligible queue rows as blocked', () => {
  const diagnostics = buildQueueDiagnostics({
    gameState: { phase: 'phase1' },
    teams: [
      { id: 'alpha', name: 'Alpha', tokens: 1, status: 'idle' },
      { id: 'bravo', name: 'Bravo', tokens: 0, status: 'timeout' },
      { id: 'charlie', name: 'Charlie', tokens: 2, status: 'eliminated' },
    ],
    matchmakingQueue: [
      { team_id: 'alpha', team_name: 'Alpha', team_tokens: 1, matched_with: null },
      { team_id: 'bravo', team_name: 'Bravo', team_tokens: 0, matched_with: null },
      { team_id: 'charlie', team_name: 'Charlie', team_tokens: 2, matched_with: null },
    ],
    matchConstraints: {},
  })

  const alphaDiagnostics = diagnostics.find((entry) => entry.teamId === 'alpha')
  assert.equal(alphaDiagnostics.hasAnyPossibleMatch, false)
  assert.match(alphaDiagnostics.blockers.find((blocker) => blocker.teamId === 'bravo').reasons.join('\n'), /Bravo is not eligible while timeout/)
  assert.match(alphaDiagnostics.blockers.find((blocker) => blocker.teamId === 'bravo').reasons.join('\n'), /Bravo has no tokens/)
  assert.match(alphaDiagnostics.blockers.find((blocker) => blocker.teamId === 'charlie').reasons.join('\n'), /Charlie is not eligible while eliminated/)
})

test('getValidDomains falls back to default domains when stored domains are empty', () => {
  const domains = getValidDomains({
    teamA: { id: 'alpha' },
    teamB: { id: 'bravo' },
    matchConstraints: {},
    allDomains: [],
  })

  assert.deepEqual(domains, ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'])
})

test('sanitizeConfiguredDomains trims domains, removes duplicates, and prevents unsafe one-domain config', () => {
  assert.deepEqual(
    sanitizeConfiguredDomains([' Tech Quiz ', 'tech quiz', '', null, 'Guess Output']),
    ['Tech Quiz', 'Guess Output']
  )

  assert.deepEqual(
    sanitizeConfiguredDomains(['Only Domain']),
    ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition']
  )
})

test('chooseDomainForMatch rejects invalid preferred domains', () => {
  assert.equal(
    chooseDomainForMatch({
      preferredDomain: 'Tech Quiz',
      validDomains: ['Guess Output'],
      fallbackDomains: ['Tech Quiz', 'Guess Output'],
    }),
    'Guess Output'
  )

  assert.equal(
    chooseDomainForMatch({
      preferredDomain: 'Guess Output',
      validDomains: ['Guess Output'],
      fallbackDomains: ['Tech Quiz', 'Guess Output'],
    }),
    'Guess Output'
  )
})

test('timeout helpers accept only positive finite overrides', () => {
  assert.equal(timeoutMinutesToMs('7'), 7 * 60 * 1000)
  assert.equal(timeoutMinutesToMs(1.5), 90 * 1000)
  assert.equal(timeoutMinutesToMs(0), null)
  assert.equal(timeoutMinutesToMs(-1), null)
  assert.equal(timeoutMinutesToMs('oops'), null)

  assert.equal(normalizeTimeoutOverrideMs(5 * 60 * 1000), 5 * 60 * 1000)
  assert.equal(normalizeTimeoutOverrideMs(0), null)
  assert.equal(normalizeTimeoutOverrideMs(-1000), null)
})

test('getTimeoutDuration falls back when stored override is invalid', () => {
  const startedAt = Date.now() - 31 * 60 * 1000

  assert.equal(
    getTimeoutDuration({
      gameState: { timeoutDurationOverride: 0, gameStartedAt: startedAt },
      now: Date.now(),
    }),
    15 * 60 * 1000
  )

  assert.equal(
    getTimeoutDuration({
      gameState: { timeout_duration_override: -1, game_started_at: startedAt },
      now: Date.now(),
    }),
    15 * 60 * 1000
  )
})

test('match outcome uses wager rules when the stored match or current phase is wager', () => {
  const phaseOneMatch = { is_wager: false }
  const wagerMatch = { is_wager: true }
  const winnerTeam = { tokens: 3 }
  const loserTeam = { tokens: 1 }

  assert.equal(isWagerMatch(phaseOneMatch, { phase: 'phase1' }), false)
  assert.deepEqual(
    calculateMatchOutcome({ winnerTeam, loserTeam, isWager: isWagerMatch(phaseOneMatch, { phase: 'phase1' }) }),
    { winnerTokens: 4, loserTokens: 0, loserStatus: 'timeout' }
  )

  assert.equal(isWagerMatch(phaseOneMatch, { phase: 'phase2' }), true)
  assert.deepEqual(
    calculateMatchOutcome({ winnerTeam, loserTeam, isWager: isWagerMatch(phaseOneMatch, { phase: 'phase2' }) }),
    { winnerTokens: 4, loserTokens: 0, loserStatus: 'eliminated' }
  )

  assert.equal(isWagerMatch(wagerMatch, { phase: 'phase1' }), true)
  assert.deepEqual(
    calculateMatchOutcome({ winnerTeam, loserTeam, isWager: isWagerMatch(wagerMatch, { phase: 'phase1' }) }),
    { winnerTokens: 4, loserTokens: 0, loserStatus: 'eliminated' }
  )
})
