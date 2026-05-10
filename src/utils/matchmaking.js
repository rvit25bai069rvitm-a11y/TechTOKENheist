// ============================================================
// MATCHMAKING ENGINE — Tech Token Heist
// Implements ALL PRD Section 4.2 constraints
// ============================================================

/**
 * Build match constraint tracking from match history.
 * Returns { [teamId]: { opponents: { [oppId]: count }, domains: { [domain]: count }, combos: { [oppId+domain]: count }, lastOpponent, lastDomain } }
 */
export function buildConstraintsFromHistory(matchHistory, teams) {
  const constraints = {}

  const ensureTeam = (id) => {
    if (!constraints[id]) {
      constraints[id] = { opponents: {}, domains: {}, combos: {}, lastOpponent: null, lastDomain: null }
    }
  }

  // Process history in chronological order
  const sorted = [...(matchHistory || [])].sort((a, b) => {
    const tA = a.created_at || a.timestamp || 0
    const tB = b.created_at || b.timestamp || 0
    return String(tA).localeCompare(String(tB))
  })

  // We need to resolve team IDs from names if history uses names
  const teamByName = new Map((teams || []).map(t => [t.name, t.id]))

  for (const match of sorted) {
    const winnerId = teamByName.get(match.winner) || match.winner_id || match.winner
    const loserId = teamByName.get(match.loser) || match.loser_id || match.loser
    const domain = match.domain

    if (!winnerId || !loserId) continue

    ensureTeam(winnerId)
    ensureTeam(loserId)

    // Track opponent counts
    constraints[winnerId].opponents[loserId] = (constraints[winnerId].opponents[loserId] || 0) + 1
    constraints[loserId].opponents[winnerId] = (constraints[loserId].opponents[winnerId] || 0) + 1

    // Track domain counts
    if (domain) {
      constraints[winnerId].domains[domain] = (constraints[winnerId].domains[domain] || 0) + 1
      constraints[loserId].domains[domain] = (constraints[loserId].domains[domain] || 0) + 1

      // Track opponent+domain combos
      const comboKeyW = `${loserId}::${domain}`
      const comboKeyL = `${winnerId}::${domain}`
      constraints[winnerId].combos[comboKeyW] = (constraints[winnerId].combos[comboKeyW] || 0) + 1
      constraints[loserId].combos[comboKeyL] = (constraints[loserId].combos[comboKeyL] || 0) + 1
    }

    // Track last opponent and last domain
    constraints[winnerId].lastOpponent = loserId
    constraints[winnerId].lastDomain = domain
    constraints[loserId].lastOpponent = winnerId
    constraints[loserId].lastDomain = domain
  }

  return constraints
}


/**
 * Get all reasons why two teams CANNOT be matched right now.
 * Returns an empty array if they CAN be matched.
 */
export function getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints }) {
  if (!teamA || !teamB) return ['Team data unavailable']

  const reasons = []
  const c = matchConstraints || {}
  const cA = c[teamA.id] || {}
  const cB = c[teamB.id] || {}
  const tokenDiff = Math.abs((teamA.tokens || 0) - (teamB.tokens || 0))

  // Phase 1: ±3 token range limit
  if (gameState?.phase !== 'phase2' && tokenDiff > 3) {
    reasons.push(`Token gap too high: ${teamA.tokens} vs ${teamB.tokens} (diff ${tokenDiff}, max 3)`)
  }

  // Max 2 times against same opponent (both phases)
  if ((cA.opponents?.[teamB.id] || 0) >= 2) {
    reasons.push('Already faced each other 2 times (max reached)')
  }

  // No consecutive repeat opponent (both phases)
  if (cA.lastOpponent === teamB.id || cB.lastOpponent === teamA.id) {
    reasons.push('Cannot face the same opponent in consecutive matches')
  }

  return reasons
}


/**
 * Get valid domains for a match between two teams, considering constraints.
 * PRD Section 4.2:
 *  - Same domain max 2 times per team
 *  - Same opponent + same domain → only 1 time
 *  - No consecutive repeat domain (Phase 2 explicitly, good practice for Phase 1 too)
 */
export function getValidDomains({ teamA, teamB, matchConstraints, allDomains }) {
  const domains = allDomains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition']
  const c = matchConstraints || {}
  const cA = c[teamA?.id] || {}
  const cB = c[teamB?.id] || {}

  return domains.filter(domain => {
    // Same domain max 2 times per team
    if ((cA.domains?.[domain] || 0) >= 2) return false
    if ((cB.domains?.[domain] || 0) >= 2) return false

    // Same opponent + same domain → only 1 time
    const comboKeyA = `${teamB?.id}::${domain}`
    const comboKeyB = `${teamA?.id}::${domain}`
    if ((cA.combos?.[comboKeyA] || 0) >= 1) return false
    if ((cB.combos?.[comboKeyB] || 0) >= 1) return false

    // No consecutive repeat domain for either team
    if (cA.lastDomain === domain) return false
    if (cB.lastDomain === domain) return false

    return true
  })
}


/**
 * Phase 1 matchmaking: prioritize smallest token difference.
 * Priority: same tokens → ±1 → ±2 → ±3
 */
function scorePhase1(teamA, teamB) {
  return Math.abs((teamA.tokens || 0) - (teamB.tokens || 0))
}

/**
 * Phase 2 matchmaking: prioritize LARGEST token difference.
 * Same-token teams get lowest priority.
 */
function scorePhase2(teamA, teamB) {
  return -Math.abs((teamA.tokens || 0) - (teamB.tokens || 0))
}


/**
 * Run the full matchmaking algorithm.
 * Returns array of { teamAId, teamBId, teamAName, teamBName } pairs.
 */
export function runMatchmaking({ gameState, teams, matchConstraints, existingMatches }) {
  const isPhase2 = gameState?.phase === 'phase2'

  // Get eligible teams: status must be 'idle' or 'queued', not eliminated, not timeout, not fighting
  const eligible = (teams || []).filter(t => {
    if (t.status === 'eliminated' || t.status === 'fighting' || t.status === 'timeout') return false
    // Check if already in an active match
    const inMatch = (existingMatches || []).some(m => {
      const aId = m.team_a || m.teamA?.id
      const bId = m.team_b || m.teamB?.id
      return aId === t.id || bId === t.id
    })
    return !inMatch
  })

  if (eligible.length < 2) return []

  // Build all possible pairs with scores
  const pairs = []
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const reasons = getQueueBlockReasons({
        gameState,
        teamA: eligible[i],
        teamB: eligible[j],
        matchConstraints,
      })
      if (reasons.length === 0) {
        const score = isPhase2
          ? scorePhase2(eligible[i], eligible[j])
          : scorePhase1(eligible[i], eligible[j])
        pairs.push({ a: eligible[i], b: eligible[j], score })
      }
    }
  }

  // Sort: Phase 1 → smallest diff first; Phase 2 → largest diff first
  pairs.sort((x, y) => x.score - y.score)

  // Greedy matching: assign pairs ensuring each team appears only once
  const matched = new Set()
  const result = []

  for (const pair of pairs) {
    if (matched.has(pair.a.id) || matched.has(pair.b.id)) continue
    matched.add(pair.a.id)
    matched.add(pair.b.id)
    result.push({
      teamAId: pair.a.id,
      teamAName: pair.a.name,
      teamBId: pair.b.id,
      teamBName: pair.b.name,
    })
  }

  return result
}


/**
 * Build queue diagnostics for the admin panel.
 * Shows each waiting team and why they are/aren't matchable with others.
 */
export function buildQueueDiagnostics({ gameState, teams, matchmakingQueue, matchConstraints }) {
  const waiting = (matchmakingQueue || []).filter((q) => !q.matchedWith)
  const byId = new Map((teams || []).map((t) => [t.id, t]))

  return waiting.map((entry) => {
    const self = byId.get(entry.teamId)
    const blockers = waiting
      .filter((other) => other.teamId !== entry.teamId)
      .map((other) => {
        const otherTeam = byId.get(other.teamId)
        const reasons = getQueueBlockReasons({ gameState, teamA: self, teamB: otherTeam, matchConstraints })
        return {
          teamId: other.teamId,
          teamName: other.teamName,
          reasons,
          canMatchNow: reasons.length === 0,
        }
      })

    return {
      teamId: entry.teamId,
      teamName: entry.teamName,
      tokens: entry.teamTokens ?? self?.tokens ?? 0,
      blockers,
      hasAnyPossibleMatch: blockers.some((b) => b.canMatchNow),
    }
  })
}


/**
 * Calculate the correct timeout duration based on game elapsed time.
 * PRD Section 4.5:
 *  - First 30 minutes: 5 minutes
 *  - After 30 minutes (until wager mode): 15 minutes
 *  - Admin can override at any time
 */
export function getTimeoutDuration({ gameState }) {
  // Admin override takes priority
  if (gameState?.timeoutDurationOverride) {
    return gameState.timeoutDurationOverride
  }

  const gameStartedAt = gameState?.gameStartedAt
  if (!gameStartedAt) return 5 * 60 * 1000 // default 5 min

  const elapsed = Date.now() - gameStartedAt
  const thirtyMinutes = 30 * 60 * 1000

  if (elapsed <= thirtyMinutes) {
    return 5 * 60 * 1000 // 5 minutes
  }
  return 15 * 60 * 1000 // 15 minutes
}


/**
 * Calculate Phase 2 wager token transfers per PRD Section 4.6.
 * Returns { winnerTokens, loserTokens, loserStatus }
 */
export function calculateWagerOutcome(winnerTeam, loserTeam) {
  const wTokens = winnerTeam.tokens ?? 1
  const lTokens = loserTeam.tokens ?? 1

  if (wTokens >= lTokens) {
    // Higher-token (or equal) team wins → takes ALL of loser's tokens → loser eliminated
    return {
      winnerTokens: wTokens + lTokens,
      loserTokens: 0,
      loserStatus: 'eliminated',
    }
  } else {
    // Lower-token team wins → gets ⌊(A + B) / 2⌋ total
    const total = wTokens + lTokens
    const winnerGets = Math.floor(total / 2)
    const loserKeeps = total - winnerGets
    return {
      winnerTokens: winnerGets,
      loserTokens: loserKeeps,
      loserStatus: loserKeeps <= 0 ? 'eliminated' : 'idle',
    }
  }
}
