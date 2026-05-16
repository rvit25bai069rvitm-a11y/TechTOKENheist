// ============================================================
// MATCHMAKING ENGINE — Tech Token Heist
// Implements PRD Section 4.2 constraints plus queue-lock safety.
// ============================================================

const DEFAULT_DOMAINS = ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition']
const ELIGIBLE_QUEUE_STATUSES = new Set(['idle', 'queued'])

const queueTeamId = (entry) => entry?.teamId || entry?.team_id
const queueTeamName = (entry) => entry?.teamName || entry?.team_name
const queueTeamTokens = (entry) => entry?.teamTokens ?? entry?.team_tokens ?? 0
const queueMatchedWith = (entry) => entry?.matchedWith || entry?.matched_with || null

const isEligibleForMatch = (team) => {
  if (!team) return { ok: false, reason: 'Team data unavailable' }

  const status = team.status || 'idle'
  if (!ELIGIBLE_QUEUE_STATUSES.has(status)) {
    return { ok: false, reason: `${team.name || team.id} is not eligible while ${status}` }
  }

  if ((team.tokens ?? 0) <= 0) {
    return { ok: false, reason: `${team.name || team.id} has no tokens` }
  }

  return { ok: true, reason: null }
}

export function sanitizeConfiguredDomains(domains) {
  const seen = new Set()
  const sanitized = []

  for (const domain of domains || []) {
    const value = String(domain || '').trim()
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    sanitized.push(value)
  }

  return sanitized.length >= 2 ? sanitized : DEFAULT_DOMAINS
}

/**
 * Build match constraint tracking from match history.
 * Returns { [teamId]: { opponents, domains, combos, lastOpponent, lastDomain } }.
 */
export function buildConstraintsFromHistory(matchHistory, teams) {
  const constraints = {}

  const ensureTeam = (id) => {
    if (!constraints[id]) {
      constraints[id] = { opponents: {}, domains: {}, combos: {}, lastOpponent: null, lastDomain: null }
    }
  }

  const sorted = [...(matchHistory || [])].sort((a, b) => {
    const tA = a.created_at || a.timestamp || 0
    const tB = b.created_at || b.timestamp || 0
    return String(tA).localeCompare(String(tB))
  })

  const teamByName = new Map((teams || []).map((team) => [team.name, team.id]))

  for (const match of sorted) {
    const winnerId = match.winner_id || match.winnerId || teamByName.get(match.winner) || match.winner
    const loserId = match.loser_id || match.loserId || teamByName.get(match.loser) || match.loser
    const domain = match.domain

    if (!winnerId || !loserId) continue

    ensureTeam(winnerId)
    ensureTeam(loserId)

    constraints[winnerId].opponents[loserId] = (constraints[winnerId].opponents[loserId] || 0) + 1
    constraints[loserId].opponents[winnerId] = (constraints[loserId].opponents[winnerId] || 0) + 1

    if (domain) {
      constraints[winnerId].domains[domain] = (constraints[winnerId].domains[domain] || 0) + 1
      constraints[loserId].domains[domain] = (constraints[loserId].domains[domain] || 0) + 1

      constraints[winnerId].combos[`${loserId}::${domain}`] = (constraints[winnerId].combos[`${loserId}::${domain}`] || 0) + 1
      constraints[loserId].combos[`${winnerId}::${domain}`] = (constraints[loserId].combos[`${winnerId}::${domain}`] || 0) + 1
    }

    constraints[winnerId].lastOpponent = loserId
    constraints[winnerId].lastDomain = domain
    constraints[loserId].lastOpponent = winnerId
    constraints[loserId].lastDomain = domain
  }

  return constraints
}

/**
 * Get all reasons why two teams cannot be matched right now.
 * Returns an empty array if they can be matched.
 */
export function getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints }) {
  if (!teamA || !teamB) return ['Team data unavailable']

  const reasons = []
  const eligibilityA = isEligibleForMatch(teamA)
  const eligibilityB = isEligibleForMatch(teamB)
  if (!eligibilityA.ok) reasons.push(eligibilityA.reason)
  if (!eligibilityB.ok) reasons.push(eligibilityB.reason)
  if ((teamA.tokens ?? 0) <= 0 && !reasons.includes(`${teamA.name || teamA.id} has no tokens`)) {
    reasons.push(`${teamA.name || teamA.id} has no tokens`)
  }
  if ((teamB.tokens ?? 0) <= 0 && !reasons.includes(`${teamB.name || teamB.id} has no tokens`)) {
    reasons.push(`${teamB.name || teamB.id} has no tokens`)
  }

  const c = matchConstraints || {}
  const cA = c[teamA.id] || {}
  const cB = c[teamB.id] || {}
  const tokenDiff = Math.abs((teamA.tokens || 0) - (teamB.tokens || 0))
  const isPhase2 = gameState?.phase === 'phase2'

  if (!isPhase2 && tokenDiff > 3) {
    reasons.push(`Token gap too high: ${teamA.tokens} vs ${teamB.tokens} (diff ${tokenDiff}, max 3)`)
  }

  if (!isPhase2 && (cA.opponents?.[teamB.id] || 0) >= 2) {
    reasons.push('Already faced each other 2 times (max reached)')
  }

  if (!isPhase2 && (cA.lastOpponent === teamB.id || cB.lastOpponent === teamA.id)) {
    reasons.push('Cannot face the same opponent in consecutive matches')
  }

  const validDomains = getValidDomains({
    teamA,
    teamB,
    matchConstraints,
    allDomains: gameState?.domains,
    phase: gameState?.phase,
  })
  if (validDomains.length === 0) {
    reasons.push('No valid domains available for this pair')
  }

  return reasons
}

/**
 * Get valid domains for a match between two teams.
 * Phase 2 ignores phase-1 allocation caps but keeps consecutive-domain safety.
 */
export function getValidDomains({ teamA, teamB, matchConstraints, allDomains, phase }) {
  const domains = sanitizeConfiguredDomains(allDomains)
  const c = matchConstraints || {}
  const cA = c[teamA?.id] || {}
  const cB = c[teamB?.id] || {}
  const isPhase2 = phase === 'phase2'

  return domains.filter((domain) => {
    if (!isPhase2) {
      if ((cA.domains?.[domain] || 0) >= 2) return false
      if ((cB.domains?.[domain] || 0) >= 2) return false

      const comboKeyA = `${teamB?.id}::${domain}`
      const comboKeyB = `${teamA?.id}::${domain}`
      if ((cA.combos?.[comboKeyA] || 0) >= 1) return false
      if ((cB.combos?.[comboKeyB] || 0) >= 1) return false
    }

    if (cA.lastDomain === domain) return false
    if (cB.lastDomain === domain) return false

    return true
  })
}

export function chooseDomainForMatch({ preferredDomain, validDomains, fallbackDomains }) {
  const seen = new Set()
  const sanitizedValid = []
  for (const domain of validDomains || []) {
    const value = String(domain || '').trim()
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    sanitizedValid.push(value)
  }

  if (sanitizedValid.length > 0 && preferredDomain && sanitizedValid.includes(preferredDomain)) {
    return preferredDomain
  }

  if (sanitizedValid.length > 0) return sanitizedValid[0]
  return sanitizeConfiguredDomains(fallbackDomains)[0]
}

function scorePhase1(teamA, teamB) {
  return Math.abs((teamA.tokens || 0) - (teamB.tokens || 0))
}

function scorePhase2(teamA, teamB) {
  return -Math.abs((teamA.tokens || 0) - (teamB.tokens || 0))
}

/**
 * Run the full matchmaking algorithm.
 * Returns array of { teamAId, teamBId, teamAName, teamBName } pairs.
 */
export function runMatchmaking({ gameState, teams, matchConstraints, existingMatches }) {
  const isPhase2 = gameState?.phase === 'phase2'

  const eligible = (teams || []).filter((team) => {
    if (!isEligibleForMatch(team).ok) return false

    const inMatch = (existingMatches || []).some((match) => {
      const aId = match.team_a || match.teamA?.id
      const bId = match.team_b || match.teamB?.id
      return aId === team.id || bId === team.id
    })
    return !inMatch
  })

  if (eligible.length < 2) return []

  const pairs = []
  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
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

  pairs.sort((x, y) => x.score - y.score)

  const buildGreedy = (seedPair = null) => {
    const matched = new Set()
    const selected = []

    if (seedPair) {
      matched.add(seedPair.a.id)
      matched.add(seedPair.b.id)
      selected.push(seedPair)
    }

    for (const pair of pairs) {
      if (matched.has(pair.a.id) || matched.has(pair.b.id)) continue
      matched.add(pair.a.id)
      matched.add(pair.b.id)
      selected.push(pair)
    }

    return selected
  }

  let best = buildGreedy()
  for (const pair of pairs) {
    const candidate = buildGreedy(pair)
    const candidateScore = candidate.reduce((total, selectedPair) => total + selectedPair.score, 0)
    const bestScore = best.reduce((total, selectedPair) => total + selectedPair.score, 0)
    if (
      candidate.length > best.length ||
      (candidate.length === best.length && candidateScore < bestScore)
    ) {
      best = candidate
    }
  }

  return best.map((pair) => ({
    teamAId: pair.a.id,
    teamAName: pair.a.name,
    teamBId: pair.b.id,
    teamBName: pair.b.name,
  }))
}

export function buildQueuePairsFromEntries(matchmakingQueue) {
  const queue = matchmakingQueue || []
  const byTeamId = new Map(queue.map((entry) => [queueTeamId(entry), entry]))
  const seen = new Set()
  const pairs = []

  for (const entry of queue) {
    const teamAId = queueTeamId(entry)
    const teamBId = queueMatchedWith(entry)
    if (!teamAId || !teamBId || teamAId === teamBId) continue

    const partner = byTeamId.get(teamBId)
    if (!partner || queueMatchedWith(partner) !== teamAId) continue

    const pairKey = [teamAId, teamBId].sort().join('::')
    if (seen.has(pairKey)) continue
    seen.add(pairKey)

    pairs.push({
      teamAId,
      teamAName: queueTeamName(entry),
      teamBId,
      teamBName: queueTeamName(partner),
    })
  }

  return pairs
}

export function findStaleMatchedQueueTeamIds(matchmakingQueue) {
  const queue = matchmakingQueue || []
  const byTeamId = new Map(queue.map((entry) => [queueTeamId(entry), entry]))
  const staleIds = new Set()

  for (const entry of queue) {
    const teamId = queueTeamId(entry)
    const matchedWith = queueMatchedWith(entry)
    if (!matchedWith) continue

    const partner = byTeamId.get(matchedWith)
    if (teamId === matchedWith || !partner || queueMatchedWith(partner) !== teamId) {
      staleIds.add(teamId)
    }
  }

  return [...staleIds]
}

export function findInvalidMatchedQueueTeamIds({ matchmakingQueue, teams, activeMatches, gameState, matchConstraints }) {
  const teamById = new Map((teams || []).map((team) => [team.id, team]))
  const activeTeamIds = new Set()
  const invalidIds = new Set()

  ;(activeMatches || []).forEach((match) => {
    const teamAId = match.team_a || match.teamA?.id
    const teamBId = match.team_b || match.teamB?.id
    if (teamAId) activeTeamIds.add(teamAId)
    if (teamBId) activeTeamIds.add(teamBId)
  })

  for (const pair of buildQueuePairsFromEntries(matchmakingQueue)) {
    const teamA = teamById.get(pair.teamAId)
    const teamB = teamById.get(pair.teamBId)
    const invalid =
      !teamA ||
      !teamB ||
      activeTeamIds.has(pair.teamAId) ||
      activeTeamIds.has(pair.teamBId) ||
      getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints }).length > 0

    if (invalid) {
      invalidIds.add(pair.teamAId)
      invalidIds.add(pair.teamBId)
    }
  }

  return [...invalidIds]
}

export function buildReadyQueuePairs({ gameState, teams, matchmakingQueue, matchConstraints, activeMatches }) {
  const teamById = new Map((teams || []).map((team) => [team.id, team]))
  const activeTeamIds = new Set()
  const readyPairs = []

  ;(activeMatches || []).forEach((match) => {
    const teamAId = match.team_a || match.teamA?.id
    const teamBId = match.team_b || match.teamB?.id
    if (teamAId) activeTeamIds.add(teamAId)
    if (teamBId) activeTeamIds.add(teamBId)
  })

  for (const pair of buildQueuePairsFromEntries(matchmakingQueue)) {
    const { teamAId, teamBId } = pair
    if (activeTeamIds.has(teamAId) || activeTeamIds.has(teamBId)) continue

    const teamA = teamById.get(teamAId)
    const teamB = teamById.get(teamBId)
    if (!teamA || !teamB) continue

    const reasons = getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints })
    if (reasons.length > 0) continue

    readyPairs.push({
      teamAId,
      teamAName: pair.teamAName || teamA.name,
      teamBId,
      teamBName: pair.teamBName || teamB.name,
    })
  }

  return readyPairs
}

/**
 * Build queue diagnostics for the admin panel.
 * Shows each waiting team and why they are or are not matchable with others.
 */
export function buildQueueDiagnostics({ gameState, teams, matchmakingQueue, matchConstraints }) {
  const waiting = (matchmakingQueue || []).filter((entry) => !queueMatchedWith(entry))
  const byId = new Map((teams || []).map((team) => [team.id, team]))

  return waiting.map((entry) => {
    const self = byId.get(queueTeamId(entry))
    const blockers = waiting
      .filter((other) => queueTeamId(other) !== queueTeamId(entry))
      .map((other) => {
        const otherTeam = byId.get(queueTeamId(other))
        const reasons = getQueueBlockReasons({ gameState, teamA: self, teamB: otherTeam, matchConstraints })
        return {
          teamId: queueTeamId(other),
          teamName: queueTeamName(other),
          reasons,
          canMatchNow: reasons.length === 0,
        }
      })

    return {
      teamId: queueTeamId(entry),
      teamName: queueTeamName(entry),
      tokens: queueTeamTokens(entry) ?? self?.tokens ?? 0,
      blockers,
      hasAnyPossibleMatch: blockers.some((blocker) => blocker.canMatchNow),
    }
  })
}

export function timeoutMinutesToMs(value) {
  const minutes = Number(value)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return minutes * 60 * 1000
}

export function normalizeTimeoutOverrideMs(value) {
  const ms = Number(value)
  if (!Number.isFinite(ms) || ms <= 0) return null
  return ms
}

/**
 * Calculate the correct timeout duration based on game elapsed time.
 */
export function getTimeoutDuration({ gameState, now = Date.now() }) {
  const override = normalizeTimeoutOverrideMs(gameState?.timeoutDurationOverride ?? gameState?.timeout_duration_override)
  if (override) return override

  const gameStartedAt = gameState?.gameStartedAt ?? gameState?.game_started_at
  if (!gameStartedAt) return 5 * 60 * 1000

  const elapsed = now - gameStartedAt
  const thirtyMinutes = 30 * 60 * 1000

  if (elapsed <= thirtyMinutes) return 5 * 60 * 1000
  return 15 * 60 * 1000
}

/**
 * Calculate Phase 2 wager token transfers per PRD Section 4.6.
 */
export function calculateWagerOutcome(winnerTeam, loserTeam) {
  const wTokens = winnerTeam.tokens ?? 1
  const lTokens = loserTeam.tokens ?? 1

  if (wTokens >= lTokens) {
    return {
      winnerTokens: wTokens + lTokens,
      loserTokens: 0,
      loserStatus: 'eliminated',
    }
  }

  const mean = Math.floor((wTokens + lTokens) / 2)
  const winnerTokens = wTokens + mean
  const loserTokens = lTokens - mean
  return {
    winnerTokens,
    loserTokens: Math.max(0, loserTokens),
    loserStatus: loserTokens <= 0 ? 'eliminated' : 'idle',
  }
}

export function isWagerMatch(match, gameState) {
  return Boolean(match?.is_wager || match?.isWager || gameState?.phase === 'phase2')
}

export function calculateMatchOutcome({ winnerTeam, loserTeam, isWager }) {
  if (isWager) return calculateWagerOutcome(winnerTeam, loserTeam)

  const winnerTokens = (winnerTeam.tokens ?? 1) + 1
  const loserTokens = Math.max(0, (loserTeam.tokens ?? 1) - 1)
  return {
    winnerTokens,
    loserTokens,
    loserStatus: loserTokens <= 0 ? 'timeout' : 'idle',
  }
}
