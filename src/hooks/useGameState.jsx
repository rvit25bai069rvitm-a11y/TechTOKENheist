import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { queryClient } from '../lib/queryClient'
import supabase from '../lib/supabase'
import { buildConstraintsFromHistory, getValidDomains, runMatchmaking } from '../utils/matchmaking'
import { getProfileAvatar } from '../data/profileAvatars'

const createInitialGameState = () => ({
  gameState: { isGameActive: false, isPaused: false, gameStartedAt: null, pausedAt: null, phase: 'phase1', status: 'not_started' },
  teams: [],
  matchmakingQueue: [],
  activeMatches: [],
  matchHistory: [],
  notifications: [],
  tokenHistory: [],
  matchConstraints: {},
})

const createInitialClientState = () => ({
  ...createInitialGameState(),
  user: null,
  countdown: null,
  gameTimer: '00:00:00',
})

let countdownInterval = null
let timerInterval = null
let fallbackPollInterval = null

const normalizeTeam = (team) => {
  const memberNames = team?.member_names || team?.memberNames || []
  return {
    ...team,
    avatarSrc: getProfileAvatar(team?.name),
    memberNames,
    members: memberNames.length,
    leader: team?.leader || memberNames[0] || team?.name,
    status: team?.status || 'idle',
    tokens: team?.tokens ?? 1,
    totalTime: team?.total_time ?? team?.totalTime ?? 0,
    timeoutUntil: team?.timeout_until ?? team?.timeoutUntil ?? null,
    lastTokenUpdateTime: team?.last_token_update_time ?? team?.lastTokenUpdateTime ?? null,
  }
}

const normalizeQueueEntry = (entry) => ({
  ...entry,
  teamId: entry?.team_id || entry?.teamId,
  teamName: entry?.team_name || entry?.teamName,
  teamTokens: entry?.team_tokens ?? entry?.teamTokens ?? 0,
  matchedWith: entry?.matched_with || entry?.matchedWith || null,
})

const upsertTeamRecord = async (teamData) => {
  try {
    const { data: existing } = await supabase.from('teams').select('id, name').ilike('name', teamData.name).limit(1).maybeSingle()

    const payload = {
      name: teamData.name,
      member_names: teamData.memberNames || [teamData.name],
      leader: teamData.leader || (teamData.memberNames?.[0]) || teamData.name,
      password: teamData.password || 'password123',
      tokens: teamData.tokens ?? 1,
      status: teamData.status || 'idle'
    }

    if (existing?.id) {
      const { error } = await supabase.from('teams').update(payload).eq('id', existing.id)
      if (error) {
        console.error('Update error:', error)
        // Fallback update if some columns are missing
        await supabase.from('teams').update({ tokens: payload.tokens, status: payload.status }).eq('id', existing.id)
      }
      return existing.id
    }

    const { data: inserted, error: insertError } = await supabase.from('teams').insert([payload]).select().maybeSingle()
    if (insertError) {
      console.error('Insert error:', insertError)
      // Fallback insert if columns are missing
      const { data: fallback, error: fallbackError } = await supabase.from('teams').insert([{ name: payload.name, tokens: payload.tokens }]).select().maybeSingle()
      if (fallbackError) {
        console.error('Fallback insert error:', fallbackError)
        return null
      }
      return fallback?.id
    }
    return inserted?.id
  } catch (err) {
    console.error('upsertTeamRecord fatal error:', err)
    return null
  }
}

const syncQueryCache = (snapshot) => {
  queryClient.setQueryData(['game-state'], snapshot)
}

const resolveMyTeam = (state) => {
  if (!state.user?.teamId) return null
  return state.teams.find((team) => team.id === state.user.teamId) || null
}

const getGameTimer = (gameState) => {
  if (gameState.isGameActive && gameState.gameStartedAt) {
    const elapsed = Date.now() - gameState.gameStartedAt
    const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0')
    const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0')
    const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  if (gameState.isPaused && gameState.gameStartedAt && gameState.pausedAt) {
    const elapsed = gameState.pausedAt - gameState.gameStartedAt
    const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0')
    const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0')
    const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  return '00:00:00'
}

const enforceWagerEliminations = async () => {
  const { data: zeroTokenTeams } = await supabase
    .from('teams')
    .select('id, name, status, tokens')
    .lte('tokens', 0)
    .neq('status', 'eliminated')

  if (!zeroTokenTeams || zeroTokenTeams.length === 0) return []

  const teamIds = zeroTokenTeams.map((team) => team.id)
  await supabase
    .from('teams')
    .update({ status: 'eliminated', timeout_until: null, last_token_update_time: Date.now() })
    .in('id', teamIds)

  await supabase.from('matchmaking_queue').delete().in('team_id', teamIds)

  try {
    await supabase.from('notifications').insert(
      zeroTokenTeams.map((team) => ({
        message: `${team.name} eliminated in WAGER mode (0 tokens).`,
        time: new Date().toLocaleTimeString(),
      }))
    )
  } catch (e) { }

  return teamIds
}

import { persist } from 'zustand/middleware'

const useGameStateStore = create(
  persist(
    (set, get) => ({
      ...createInitialClientState(),
      applyServerState: (snapshot) => {
        set((current) => ({
          ...current,
          ...snapshot,
          user: current.user,
          countdown: current.countdown,
        }))
        syncQueryCache(snapshot)
      },
      resetClientState: () => {
        set({ ...createInitialClientState() })
        syncQueryCache(createInitialGameState())
      },
      setCountdown: (countdown) => set({ countdown }),
      setGameTimer: (gameTimer) => set({ gameTimer }),
      login: (username, password) => {
        return (async () => {
          try {
            // Admin login check (Credentials moved to database to prevent hardcoded exposure)
            const { data: authRecord, error: authError } = await supabase
              .from('system')
              .select('status')
              .eq('key', 'admin_credential')
              .maybeSingle()

            if (authRecord && authRecord.status === window.btoa(`${username}:${password}`)) {
              set({ user: { role: 'admin', teamId: null, teamName: null } })
              return { success: true, role: 'admin' }
            }

            const { data: team, error } = await supabase
              .from('teams')
              .select('*')
              .ilike('name', username)
              .limit(1)
              .maybeSingle()

            if (error) return { success: false, error: error.message }
            if (!team) return { success: false, error: 'Invalid username or password' }
            // If the teams table has no password column, allow login when the team exists (dev mode)
            if (team.password === undefined) {
              set({ user: { role: 'player', teamId: team.id, teamName: team.name, avatarSrc: getProfileAvatar(team.name) } })
              return { success: true, role: 'player', teamId: team.id, teamName: team.name }
            }

            if (team.password !== password) return { success: false, error: 'Invalid username or password' }

            set({ user: { role: 'player', teamId: team.id, teamName: team.name, avatarSrc: getProfileAvatar(team.name) } })
            return { success: true, role: 'player', teamId: team.id, teamName: team.name }
          } catch (err) {
            return { success: false, error: err.message }
          }
        })()
      },
      logout: () => set({ user: null }),
      joinQueue: async () => {
        const myTeam = resolveMyTeam(get())
        if (!myTeam) return
        if (myTeam.status !== 'idle' || myTeam.tokens <= 0 || myTeam.status === 'eliminated') return
        // Prevent duplicate queue entries
        const { data: existing } = await supabase.from('matchmaking_queue').select('id').eq('team_id', myTeam.id).maybeSingle()
        if (existing) return
        await supabase.from('matchmaking_queue').insert([{ team_id: myTeam.id, team_name: myTeam.name, team_tokens: myTeam.tokens }])
      },
      leaveQueue: async () => {
        const myTeam = resolveMyTeam(get())
        if (!myTeam) return
        if (myTeam.status === 'eliminated') return
        await supabase.from('matchmaking_queue').delete().eq('team_id', myTeam.id)
      },
      // PRD 4.2: Auto-enroll ALL eligible teams into queue
      enrollAllEligible: async () => {
        const { data: allTeams } = await supabase.from('teams').select('*')
        const { data: queueRows } = await supabase.from('matchmaking_queue').select('team_id')
        const { data: matchRows } = await supabase.from('active_matches').select('team_a, team_b')
        const inQueue = new Set((queueRows || []).map(q => q.team_id))
        const inMatch = new Set()
        for (const m of (matchRows || [])) { inMatch.add(m.team_a); inMatch.add(m.team_b) }

        const toEnroll = (allTeams || []).filter(t =>
          t.status !== 'eliminated' && t.status !== 'timeout' && t.status !== 'fighting' &&
          !inQueue.has(t.id) && !inMatch.has(t.id)
        )
        if (toEnroll.length > 0) {
          await supabase.from('matchmaking_queue').insert(
            toEnroll.map(t => ({ team_id: t.id, team_name: t.name, team_tokens: t.tokens }))
          )
        }
      },
      startGame: async () => {
        const { data: sys } = await supabase.from('system').select('*').eq('key', 'game').limit(1).maybeSingle()
        const isResume = sys?.is_paused
        await supabase.from('system').update({
          is_game_active: true, is_paused: false, status: 'active',
          game_started_at: isResume ? (sys?.game_started_at || Date.now()) : Date.now(),
          paused_at: null
        }).eq('key', 'game')

        if (sys?.phase === 'phase2') {
          await enforceWagerEliminations()
        }

        // Auto-enroll all eligible teams
        await get().enrollAllEligible()
        get().autoMatchPairs()
      },
      stopGame: async () => {
        await supabase.from('system').update({ is_game_active: false, is_paused: true, paused_at: Date.now(), status: 'paused' }).eq('key', 'game')
        try {
          await supabase.from('notifications').insert([{ message: `Mission on HOLD by Command.`, time: new Date().toLocaleTimeString() }])
        } catch (e) { }
      },
      resetGame: async () => {
        // Clear runtime state and credentials, but keep the 24 profile identities in place.
        await supabase.from('matchmaking_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('active_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('match_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('token_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        const { data: teamsToReset } = await supabase.from('teams').select('id, name')
        await Promise.all((teamsToReset || []).map((team) => supabase.from('teams').update({
          member_names: [team.name],
          leader: team.name,
          password: 'password123',
          tokens: 1,
          status: 'idle',
          timeout_until: null,
          last_token_update_time: null,
        }).eq('id', team.id)))

        await supabase.from('system').update({
          is_game_active: false,
          is_paused: false,
          status: 'not_started',
          phase: 'phase1',
          game_started_at: null,
          paused_at: null,
          timeout_duration_override: null,
          domains: ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition']
        }).eq('key', 'game')
      },
      togglePhase: async () => {
        const { data: sys } = await supabase.from('system').select('*').eq('key', 'game').limit(1).maybeSingle()
        const newPhase = sys?.phase === 'phase2' ? 'phase1' : 'phase2'
        await supabase.from('system').update({ phase: newPhase }).eq('key', 'game')
        try {
          await supabase.from('notifications').insert([{ message: `System override: INITIATING ${newPhase === 'phase2' ? 'PHASE 02 (WAGER)' : 'PHASE 01 (STANDARD)'}.`, time: new Date().toLocaleTimeString() }])
        } catch (e) { }
        if (newPhase === 'phase2') {
          await enforceWagerEliminations()
        }
        get().triggerFetchPublicState?.()
      },
      createTeam: async (teamData) => {
        const teamId = await upsertTeamRecord({ ...teamData, tokens: 1, status: 'idle' })

        // PRD 4.2: If game is active, auto-enroll the new team immediately
        const state = get()
        if (teamId && state.gameState.isGameActive && !state.gameState.isPaused) {
          try {
            await supabase.from('matchmaking_queue').insert([{
              team_id: teamId,
              team_name: teamData.name,
              team_tokens: 1
            }])
            await supabase.from('notifications').insert([{ message: `${teamData.name} has joined the heist.`, time: new Date().toLocaleTimeString() }])
          } catch (e) {
            console.error('Failed to auto-enroll new team:', e)
          }
        } else {
          try {
            await supabase.from('notifications').insert([{ message: `New crew recruited: ${teamData.name}.`, time: new Date().toLocaleTimeString() }])
          } catch (e) { }
        }

        if (get().triggerFetchPublicState) {
          await get().triggerFetchPublicState()
        }
      },
      editTeam: async (teamData) => {
        await supabase.from('teams').update(teamData).eq('id', teamData.id)
        get().triggerFetchPublicState?.()
      },
      deleteTeam: async (id) => {
        await supabase.from('teams').delete().eq('id', id)
        get().triggerFetchPublicState?.()
      },
      updateTokens: async (teamId, amount, reason) => {
        const { data: team } = await supabase.from('teams').select('tokens,status').eq('id', teamId).limit(1).maybeSingle()
        if (!team) return
        const newTokens = team.tokens + amount;
        const updates = { tokens: Math.max(0, newTokens), last_token_update_time: Date.now() };

        const { data: system } = await supabase.from('system').select('*').eq('key', 'game').limit(1).maybeSingle();
        const isPhase2 = system?.phase === 'phase2';

        if (newTokens > 0 && team.status === 'timeout') {
          updates.status = 'idle';
          updates.timeout_until = null;
        } else if (newTokens <= 0) {
          if (isPhase2) {
            updates.status = 'eliminated';
            updates.timeout_until = null;
          } else if (team.status !== 'timeout') {
            updates.status = 'timeout';
            let timeoutMs = 5 * 60 * 1000;
            if (system?.timeout_duration_override) {
              timeoutMs = system.timeout_duration_override;
            } else if (system?.game_started_at) {
              const elapsed = Date.now() - system.game_started_at;
              timeoutMs = elapsed <= 30 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000;
            }
            updates.timeout_until = Date.now() + timeoutMs;
          }
          // Remove from queue if they hit 0
          await supabase.from('matchmaking_queue').delete().eq('team_id', teamId);
        }

        await supabase.from('teams').update(updates).eq('id', teamId);
        try {
          await supabase.from('notifications').insert([{
            message: `Admin adjusted tokens for ${team?.name || 'Unknown'}: ${amount > 0 ? '+' : ''}${amount} TKN.`,
            time: new Date().toLocaleTimeString()
          }])
        } catch (e) { }
        get().triggerFetchPublicState?.();
      },
      recoverFromTimeout: async (teamId, teamName) => {
        // Only recover if they are still in timeout to prevent duplicate calls
        const { data: team } = await supabase.from('teams').select('status').eq('id', teamId).limit(1).maybeSingle();
        if (team?.status !== 'timeout') return;

        await supabase.from('teams').update({ tokens: 1, status: 'idle', timeout_until: null, last_token_update_time: Date.now() }).eq('id', teamId);

        // Auto re-enroll
        const { data: inQueue } = await supabase.from('matchmaking_queue').select('id').eq('team_id', teamId).maybeSingle();
        if (!inQueue) {
          await supabase.from('matchmaking_queue').insert([{ team_id: teamId, team_name: teamName, team_tokens: 1 }]);
        }
        get().triggerFetchPublicState?.();
      },
      createMatch: async (teamAId, teamBId, domain) => {
        const { data: teamA } = await supabase.from('teams').select('id,name,tokens,status').eq('id', teamAId).limit(1).maybeSingle()
        const { data: teamB } = await supabase.from('teams').select('id,name,tokens,status').eq('id', teamBId).limit(1).maybeSingle()
        if (!teamA || !teamB) return null
        if (teamA.status === 'eliminated' || teamB.status === 'eliminated') return null
        if ((teamA.tokens ?? 0) <= 0 || (teamB.tokens ?? 0) <= 0) return null
        const { data: match } = await supabase
          .from('active_matches')
          .insert([
            {
              team_a: teamAId,
              team_b: teamBId,
              domain,
              start_time: Date.now(),
              teamA: teamA ? { id: teamA.id, name: teamA.name, tokens: teamA.tokens, status: 'fighting' } : null,
              teamB: teamB ? { id: teamB.id, name: teamB.name, tokens: teamB.tokens, status: 'fighting' } : null,
            },
          ])
          .select()
          .maybeSingle()
        await supabase.from('matchmaking_queue').delete().or(`team_id.eq.${teamAId},team_id.eq.${teamBId}`)
        await supabase.from('teams').update({ status: 'fighting' }).in('id', [teamAId, teamBId])
        try {
          await supabase.from('notifications').insert([{ message: `Match started: ${teamA?.name || teamAId} vs ${teamB?.name || teamBId}`, time: new Date().toLocaleTimeString() }])
        } catch (e) { }
        return match
      },
      declareWinner: async (matchId, winnerId) => {
        const { data: match } = await supabase.from('active_matches').select('*').eq('id', matchId).limit(1).maybeSingle()
        if (!match) return
        const { data: system } = await supabase.from('system').select('*').eq('key', 'game').limit(1).maybeSingle()
        const loserId = match.team_a === winnerId ? match.team_b : match.team_a

        const { data: winnerTeam } = await supabase.from('teams').select('*').eq('id', winnerId).limit(1).maybeSingle()
        const { data: loserTeam } = await supabase.from('teams').select('*').eq('id', loserId).limit(1).maybeSingle()
        if (!winnerTeam || !loserTeam) {
          await supabase.from('active_matches').delete().eq('id', matchId)
          return
        }

        // PRD 4.6: Any match ending while Phase 2 is active follows wager rules
        const isWager = Boolean(match?.is_wager || match?.isWager || system?.phase === 'phase2')

        let winnerTokens, loserTokens, loserStatus
        const wTk = winnerTeam.tokens ?? 1
        const lTk = loserTeam.tokens ?? 1

        if (isWager) {
          // PRD 4.6 Wager Mode token transfer
          if (wTk >= lTk) {
            // Higher-token (or equal) team wins → takes ALL loser tokens → loser eliminated
            winnerTokens = wTk + lTk
            loserTokens = 0
            loserStatus = 'eliminated'
          } else {
            // Lower-token team wins → gets floor((A+B)/2) tokens total
            const total = wTk + lTk
            winnerTokens = Math.floor(total / 2)
            loserTokens = total - winnerTokens
            loserStatus = loserTokens <= 0 ? 'eliminated' : 'idle'
          }
        } else {
          // Phase 1: +1/-1
          winnerTokens = wTk + 1
          loserTokens = Math.max(0, lTk - 1)
          if (loserTokens === 0) {
            // PRD 4.5: Dynamic timeout duration
            loserStatus = 'timeout'
          } else {
            loserStatus = 'idle'
          }
        }

        // PRD 4.5: Calculate timeout duration dynamically
        let timeoutMs = null
        if (loserStatus === 'timeout') {
          const gameStartedAt = system?.game_started_at
          const override = system?.timeout_duration_override
          if (override) {
            timeoutMs = override
          } else if (gameStartedAt) {
            const elapsed = Date.now() - gameStartedAt
            timeoutMs = elapsed <= 30 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000
          } else {
            timeoutMs = 5 * 60 * 1000
          }
        }

        await supabase.from('teams').update({
          tokens: winnerTokens, status: 'idle',
          last_token_update_time: Date.now(), timeout_until: null,
        }).eq('id', winnerId)

        await supabase.from('teams').update({
          tokens: loserTokens, status: loserStatus,
          last_token_update_time: Date.now(),
          timeout_until: loserStatus === 'timeout' ? Date.now() + timeoutMs : null,
        }).eq('id', loserId)

        const winDelta = winnerTokens - wTk
        const loseDelta = loserTokens - lTk
        try {
          await supabase.from('token_history').insert([
            { team: winnerTeam.name, change: `+${winDelta}`, reason: isWager ? 'Wager win' : 'Match win', timestamp: new Date().toLocaleTimeString() },
            { team: loserTeam.name, change: `${loseDelta}`, reason: isWager ? 'Wager loss' : 'Match loss', timestamp: new Date().toLocaleTimeString() },
          ])
        } catch (e) { }

        try {
          await supabase.from('notifications').insert([
            { message: `${winnerTeam.name} defeated ${loserTeam.name}${isWager ? ' (WAGER)' : ''}`, time: new Date().toLocaleTimeString() },
          ])
        } catch (e) { }

        try {
          await supabase.from('match_history')
            .insert([{ id: `mh_${matchId}`, winner: winnerTeam.name, loser: loserTeam.name, domain: match.domain, timestamp: new Date().toLocaleTimeString(), is_wager: isWager }])
        } catch (e) {
          await supabase.from('match_history')
            .insert([{ id: `mh_${matchId}`, winner: winnerTeam.name, loser: loserTeam.name, domain: match.domain, timestamp: new Date().toLocaleTimeString() }])
        }
        await supabase.from('active_matches').delete().eq('id', matchId)
      },
      spinDomain: async (matchId, preferredDomain) => {
        // PRD 4.3: Domain assignment with constraint validation
        const { data: match } = await supabase.from('active_matches').select('*').eq('id', matchId).limit(1).maybeSingle()
        if (!match) return { domain: preferredDomain || 'TBD' }

        const { data: historyRows } = await supabase.from('match_history').select('*')
        const { data: teamsRows } = await supabase.from('teams').select('*')
        const { data: system } = await supabase.from('system').select('*').eq('key', 'game').limit(1).maybeSingle()

        const teams = (teamsRows || []).map(normalizeTeam)
        const constraints = buildConstraintsFromHistory(historyRows || [], teams)
        const allDomains = system?.domains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition']

        const teamA = teams.find(t => t.id === match.team_a)
        const teamB = teams.find(t => t.id === match.team_b)
        const validDomains = getValidDomains({ teamA, teamB, matchConstraints: constraints, allDomains })

        let domain = preferredDomain
        if (!domain || !validDomains.includes(domain)) {
          // Pick random from valid domains, or fallback to any domain
          domain = validDomains.length > 0
            ? validDomains[Math.floor(Math.random() * validDomains.length)]
            : allDomains[Math.floor(Math.random() * allDomains.length)]
        }

        await supabase.from('active_matches').update({ domain }).eq('id', matchId)
        return { domain, validDomains }
      },
      updateDomains: async (domains) => {
        await supabase.from('system').update({ domains }).eq('key', 'game')
      },
      setTimeoutDuration: async (durationMs) => {
        await supabase.from('system').update({ timeout_duration_override: durationMs }).eq('key', 'game')
      },
      autoMatchPairs: async () => {
        const state = get()
        if (!state.gameState.isGameActive || state.gameState.isPaused) return

        // Find all waiting teams that aren't matched yet
        const waitingQueueIds = state.matchmakingQueue.filter(q => !q.matchedWith).map(q => q.teamId)
        if (waitingQueueIds.length < 2) return

        const waitingTeams = state.teams.filter(t => waitingQueueIds.includes(t.id))

        // Run matchmaking engine
        const pairs = runMatchmaking({
          gameState: state.gameState,
          teams: waitingTeams,
          matchConstraints: state.matchConstraints,
          existingMatches: state.activeMatches
        })

        if (pairs.length > 0) {
          // Update Supabase to lock in the matched pairs
          const updatePromises = pairs.flatMap(p => [
            supabase.from('matchmaking_queue').update({ matched_with: p.teamBId }).eq('team_id', p.teamAId),
            supabase.from('matchmaking_queue').update({ matched_with: p.teamAId }).eq('team_id', p.teamBId)
          ])
          await Promise.all(updatePromises)
          get().triggerFetchPublicState?.()
        }
      },
    }),
    {
      name: 'heist-auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

const useGameSocketBridge = () => {
  const gameState = useGameStateStore((state) => state.gameState)
  const socketUser = useGameStateStore((state) => state.user)
  const socketTeams = useGameStateStore((state) => state.teams)
  const setGameTimer = useGameStateStore((state) => state.setGameTimer)

  useEffect(() => {
    let channel = null

    const fetchPublicState = async () => {
      try {
        // Run all queries in parallel for the fastest "no lag" response
        const [
          { data: systemRows, error: sysErr },
          { data: teamsRows, error: teamErr },
          { data: queueRows, error: queueErr },
          { data: matchRows, error: matchErr },
          { data: historyRows, error: histErr },
          { data: notificationRows, error: notifErr },
          { data: tokenHistory, error: tokErr }
        ] = await Promise.all([
          supabase.from('system').select('*'),
          supabase.from('teams').select('*').order('name', { ascending: true }),
          supabase.from('matchmaking_queue').select('*'),
          supabase.from('active_matches').select('*'),
          supabase.from('match_history').select('*'),
          supabase.from('notifications').select('*'),
          supabase.from('token_history').select('*')
        ]);

        const queryErrors = [
          ['system', sysErr],
          ['teams', teamErr],
          ['matchmaking_queue', queueErr],
          ['active_matches', matchErr],
          ['match_history', histErr],
          ['notifications', notifErr],
          ['token_history', tokErr],
        ].filter(([, err]) => Boolean(err))

        if (queryErrors.length > 0) {
          console.group('Supabase public state fetch errors')
          queryErrors.forEach(([tableName, err]) => {
            console.error(`${tableName} error:`, err)
          })
          console.groupEnd()
        }

        const system = (systemRows && systemRows[0]) || {}

        const teams = (teamsRows || []).map(normalizeTeam)
        const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))

        const matchmakingQueue = (queueRows || []).map(normalizeQueueEntry)
        const activeMatches = (matchRows || []).map((m) => {
          const teamAId = m.team_a || m.teamA?.id
          const teamBId = m.team_b || m.teamB?.id
          const teamA = m.teamA || (teamAId ? teamById[teamAId] : null)
          const teamB = m.teamB || (teamBId ? teamById[teamBId] : null)
          return {
            ...m,
            startTime: m.start_time || m.startTime || Date.now(),
            isWager: Boolean(m.is_wager || m.isWager),
            teamA: teamA || { id: teamAId, name: 'Unknown', tokens: 0, status: 'idle' },
            teamB: teamB || { id: teamBId, name: 'Unknown', tokens: 0, status: 'idle' },
          }
        })

        const matchHistory = (historyRows || []).map((h) => ({
          ...h,
          winner: teamById[h.winner]?.name || h.winner,
          loser: teamById[h.loser]?.name || h.loser,
          isWager: Boolean(h.is_wager || h.isWager),
        }))

        const notifications = (notificationRows || []).map((n) => ({
          ...n,
          time: n.time || (n.created_at ? new Date(n.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()),
        }))

        // Build constraints dynamically from match history
        const builtConstraints = buildConstraintsFromHistory(historyRows || [], teams)

        const publicState = {
          gameState: {
            isGameActive: system.is_game_active || false,
            isPaused: system.is_paused || false,
            status: system.status || 'not_started',
            phase: system.phase || 'phase1',
            gameStartedAt: system.game_started_at || null,
            pausedAt: system.paused_at || null,
            domains: system.domains || [],
            timeoutDurationOverride: system.timeout_duration_override || null,
          },
          teams,
          matchmakingQueue,
          activeMatches,
          matchHistory,
          notifications,
          tokenHistory: tokenHistory || [],
          matchConstraints: builtConstraints,
        }

        useGameStateStore.getState().applyServerState(publicState)

        // Auto-recovery is now handled by the realtime interval below

      } catch (err) {
        console.error('Failed to fetch public state from Supabase', err)
      }
    }

    // Assign fetchPublicState to the store so mutations can trigger it manually for "No Lag" instant updates
    useGameStateStore.setState({ triggerFetchPublicState: fetchPublicState });

    fetchPublicState()

    const tables = ['system', 'teams', 'matchmaking_queue', 'active_matches', 'match_history', 'notifications', 'token_history']
    channel = supabase.channel('public-state')
    tables.forEach((t) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        fetchPublicState()
      })
    })
    channel.subscribe()

    // Fallback polling keeps UI synced even if realtime is not enabled in Supabase.
    if (fallbackPollInterval) clearInterval(fallbackPollInterval)
    fallbackPollInterval = setInterval(fetchPublicState, 5000)

    return () => {
      try {
        if (channel) channel.unsubscribe()
      } catch (e) { }
      if (fallbackPollInterval) clearInterval(fallbackPollInterval)
      fallbackPollInterval = null
      if (countdownInterval) clearInterval(countdownInterval)
      if (timerInterval) clearInterval(timerInterval)
    }
  }, [])

  useEffect(() => {
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = null

    if (gameState.isGameActive && gameState.gameStartedAt) {
      const tick = () => setGameTimer(getGameTimer(gameState))
      tick()
      timerInterval = setInterval(tick, 1000)
    } else if (gameState.isPaused && gameState.gameStartedAt && gameState.pausedAt) {
      setGameTimer(getGameTimer(gameState))
    } else {
      setGameTimer('00:00:00')
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval)
    }
  }, [gameState.isGameActive, gameState.isPaused, gameState.gameStartedAt, gameState.pausedAt, setGameTimer])

  // Real-time timeout recovery interval
  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      const state = useGameStateStore.getState()
      const now = Date.now()

      if (!state.gameState.isGameActive || state.gameState.isPaused || state.gameState.phase === 'phase2') return

      const myTeam = resolveMyTeam(state)
      const userRole = state.user?.role

      if (myTeam && myTeam.status === 'timeout' && myTeam.timeoutUntil && myTeam.timeoutUntil <= now) {
        state.recoverFromTimeout(myTeam.id, myTeam.name)
      } else if (userRole === 'admin') {
        const expired = state.teams.filter(t => t.status === 'timeout' && t.timeoutUntil && t.timeoutUntil <= now)
        expired.forEach(t => state.recoverFromTimeout(t.id, t.name))
      }
    }, 1000)

    return () => clearInterval(recoveryInterval)
  }, [])

  // Real-time matchmaking engine (Admin only)
  useEffect(() => {
    if (socketUser?.role !== 'admin') return

    const matchmakingInterval = setInterval(() => {
      const state = useGameStateStore.getState()
      if (state.gameState.isGameActive && !state.gameState.isPaused) {
        state.autoMatchPairs()
      }
    }, 3000) // Run matchmaking every 3 seconds

    return () => clearInterval(matchmakingInterval)
  }, [socketUser?.role])

  // Safety net: in wager mode, any team at 0 tokens is force-eliminated.
  useEffect(() => {
    const shouldEnforce =
      gameState.isGameActive &&
      !gameState.isPaused &&
      gameState.phase === 'phase2' &&
      socketUser?.role === 'admin' &&
      (socketTeams || []).some((team) => (team.tokens ?? 0) <= 0 && team.status !== 'eliminated')

    if (!shouldEnforce) return

    enforceWagerEliminations().then(() => {
      useGameStateStore.getState().triggerFetchPublicState?.()
    })
  }, [gameState.isGameActive, gameState.isPaused, gameState.phase, socketUser?.role, socketTeams])

  // Session Validation: Automatically logout players if their team is deleted (Reset)
  const { user, teams, logout } = useGameStateStore();
  useEffect(() => {
    if (user?.role === 'player') {
      const teamExists = teams.some(t => t.id === user.teamId);
      // Only logout if teams have been loaded AND the player's team is definitively missing.
      // We skip the logout if teams.length is 0 to avoid kicking people out during initial fetch.
      if (teams.length > 0 && !teamExists) {
        logout();
      }
    }
  }, [user, teams, logout]);
}

export const GameStateProvider = ({ children }) => {
  useGameSocketBridge()
  return children
}

export const useGameState = () => {
  const state = useGameStateStore()
  const myTeam = resolveMyTeam(state)

  const sortedLeaderboard = useMemo(() => {
    return [...state.teams].sort((a, b) => {
      if (b.tokens !== a.tokens) return b.tokens - a.tokens
      return (a.lastTokenUpdateTime || 0) - (b.lastTokenUpdateTime || 0)
    })
  }, [state.teams])

  const currentActiveMatch = useMemo(() => {
    if (!myTeam) return null
    return (
      state.activeMatches.find((match) => {
        const aId = match?.teamA?.id || match?.team_a
        const bId = match?.teamB?.id || match?.team_b
        return aId === myTeam.id || bId === myTeam.id
      }) || null
    )
  }, [state.activeMatches, myTeam])

  const isInQueue = useMemo(() => {
    if (!myTeam) return false
    return (state.matchmakingQueue || []).some((queueEntry) => (queueEntry.teamId || queueEntry.team_id) === myTeam.id)
  }, [state.matchmakingQueue, myTeam])

  const myQueueEntry = useMemo(() => {
    if (!myTeam) return null
    return myTeam ? (state.matchmakingQueue || []).find((queueEntry) => (queueEntry.teamId || queueEntry.team_id) === myTeam.id) : null
  }, [state.matchmakingQueue, myTeam])

  const queuePairs = useMemo(() => {
    const queue = state.matchmakingQueue || []
    return queue.filter((entry) => entry.matchedWith || entry.matched_with).reduce((pairs, entry) => {
      const entryTeamId = entry.teamId || entry.team_id
      const entryTeamName = entry.teamName || entry.team_name
      const matchedWith = entry.matchedWith || entry.matched_with
      const partner = queue.find((candidate) => (candidate.teamId || candidate.team_id) === matchedWith)
      if (partner && !pairs.find((pair) => pair.teamAId === matchedWith)) {
        pairs.push({
          teamAId: entryTeamId,
          teamAName: entryTeamName,
          teamBId: partner.teamId || partner.team_id,
          teamBName: partner.teamName || partner.team_name,
        })
      }
      return pairs
    }, [])
  }, [state.matchmakingQueue])

  return {
    ...state,
    myTeam,
    sortedLeaderboard,
    currentActiveMatch,
    isInQueue,
    myQueueEntry,
    queuePairs,
  }
}

export { useGameStateStore }