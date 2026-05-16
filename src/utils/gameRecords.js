export const buildMatchHistoryEntry = ({ winnerId, loserId, winnerName, loserName, domain, timestamp, isWager }) => ({
  winner_id: winnerId,
  loser_id: loserId,
  winner: winnerName,
  loser: loserName,
  domain,
  timestamp,
  is_wager: Boolean(isWager),
})

export const normalizeMatchHistoryRows = (historyRows, teams) => {
  const teamById = new Map((teams || []).map((team) => [team.id, team]))

  return (historyRows || []).map((entry) => ({
    ...entry,
    winner: teamById.get(entry.winner_id)?.name || entry.winner,
    loser: teamById.get(entry.loser_id)?.name || entry.loser,
    isWager: Boolean(entry.is_wager || entry.isWager),
  }))
}

export const buildQueueRowsForEligibleTeams = (teams) => (
  (teams || [])
    .filter((team) => team?.status === 'idle' && (team.tokens ?? 0) > 0)
    .map((team) => ({
      team_id: team.id,
      team_name: team.name,
      team_tokens: team.tokens,
    }))
)

export const buildTeamRuntimeReset = () => ({
  tokens: 1,
  status: 'idle',
  timeout_until: null,
  last_token_update_time: null,
})
