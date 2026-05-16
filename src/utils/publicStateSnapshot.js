import { getProfileAvatar } from '../data/profileAvatars.js'
import { buildConstraintsFromHistory } from './matchmaking.js'

export const SAFE_TEAM_COLUMNS = 'id, name, member_names, leader, tokens, status, total_time, timeout_until, last_token_update_time, created_at'

const PRIVATE_TEAM_FIELDS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'credential',
  'credentials',
  'secret',
  'authToken',
  'jwt',
  'session',
])

export const toMillis = (value) => {
  if (!value) return null
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed)
      return Number.isNaN(asNumber) ? null : asNumber
    }
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export const formatToIST = (value) => {
  try {
    const d = value ? new Date(value) : new Date()
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(d)
  } catch {
    try { return new Date(value || Date.now()).toLocaleString() } catch { return String(value) }
  }
}

export const stripPrivateTeamSnapshot = (team) => {
  if (!team || typeof team !== 'object') return team
  return Object.fromEntries(
    Object.entries(team).filter(([key]) => !PRIVATE_TEAM_FIELDS.has(key))
  )
}

export const normalizeTeam = (team) => {
  const safeTeam = stripPrivateTeamSnapshot(team) || {}
  const memberNames = safeTeam.member_names || safeTeam.memberNames || []
  return {
    ...safeTeam,
    avatarSrc: getProfileAvatar(safeTeam.name),
    memberNames,
    members: memberNames.length,
    leader: safeTeam.leader || memberNames[0] || safeTeam.name,
    status: safeTeam.status || 'idle',
    tokens: safeTeam.tokens ?? 1,
    totalTime: safeTeam.total_time ?? safeTeam.totalTime ?? 0,
    timeoutUntil: toMillis(safeTeam.timeout_until ?? safeTeam.timeoutUntil ?? null),
    lastTokenUpdateTime: toMillis(safeTeam.last_token_update_time ?? safeTeam.lastTokenUpdateTime ?? null),
  }
}

export const normalizeQueueEntry = (entry) => ({
  ...entry,
  teamId: entry?.team_id || entry?.teamId,
  teamName: entry?.team_name || entry?.teamName,
  teamTokens: entry?.team_tokens ?? entry?.teamTokens ?? 0,
  matchedWith: entry?.matched_with || entry?.matchedWith || null,
})

const fallbackTeam = (id) => ({
  id,
  name: 'Unknown',
  tokens: 0,
  status: 'idle',
})

const normalizeActiveMatch = (match, teamById) => {
  const teamAId = match?.team_a || match?.teamA?.id
  const teamBId = match?.team_b || match?.teamB?.id
  const teamA = match?.teamA || (teamAId ? teamById[teamAId] : null) || fallbackTeam(teamAId)
  const teamB = match?.teamB || (teamBId ? teamById[teamBId] : null) || fallbackTeam(teamBId)
  const startTime = toMillis(match?.start_time || match?.startTime)

  return {
    ...match,
    startTime: startTime || Date.now(),
    isWager: Boolean(match?.is_wager || match?.isWager),
    teamA: normalizeTeam(teamA),
    teamB: normalizeTeam(teamB),
  }
}

export const buildPublicStateSnapshot = ({
  systemRows = [],
  teamsRows = [],
  queueRows = [],
  matchRows = [],
  historyRows = [],
  notificationRows = [],
  tokenHistory = [],
} = {}) => {
  const system = (systemRows || []).find((row) => row?.key === 'game') || {}
  const teams = (teamsRows || []).map(normalizeTeam)
  const teamById = Object.fromEntries(teams.map((team) => [team.id, team]))

  const matchmakingQueue = (queueRows || []).map(normalizeQueueEntry)
  const activeMatches = (matchRows || []).map((match) => normalizeActiveMatch(match, teamById))

  const matchHistory = (historyRows || []).map((history) => {
    const winnerId = history.winner_id || history.winner
    const loserId = history.loser_id || history.loser
    return {
      ...history,
      winner: teamById[winnerId]?.name || history.winner,
      loser: teamById[loserId]?.name || history.loser,
      isWager: Boolean(history.is_wager || history.isWager),
      time: history.timestamp ? formatToIST(history.timestamp) : (history.created_at ? formatToIST(history.created_at) : ''),
    }
  })

  const notifications = (notificationRows || []).map((notification) => ({
    ...notification,
    time: notification.time
      ? formatToIST(notification.time)
      : (notification.created_at ? formatToIST(notification.created_at) : formatToIST()),
  }))

  const tokenHistoryFormatted = (tokenHistory || []).map((tokenEvent) => ({
    ...tokenEvent,
    time: tokenEvent.timestamp ? formatToIST(tokenEvent.timestamp) : (tokenEvent.created_at ? formatToIST(tokenEvent.created_at) : ''),
  }))

  return {
    gameState: {
      isGameActive: system.is_game_active || false,
      isPaused: system.is_paused || false,
      status: system.status || 'not_started',
      phase: system.phase || 'phase1',
      gameStartedAt: toMillis(system.game_started_at),
      pausedAt: toMillis(system.paused_at),
      domains: system.domains || [],
      timeoutDurationOverride: system.timeout_duration_override || null,
      finaleState: system.finale_state || null,
    },
    teams,
    matchmakingQueue,
    activeMatches,
    matchHistory,
    notifications,
    tokenHistory: tokenHistoryFormatted,
    matchConstraints: buildConstraintsFromHistory(historyRows || [], teams),
  }
}
