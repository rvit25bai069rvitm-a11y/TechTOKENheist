import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '../lib/queryClient'
import supabase, { hasSupabaseConfig } from '../lib/supabase'
import { getProfileAvatar } from '../data/profileAvatars'
import { buildReadyQueuePairs } from '../utils/matchmaking'
import { buildPublicStateSnapshot, SAFE_TEAM_COLUMNS, toMillis } from '../utils/publicStateSnapshot'

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
  hasHydrated: false,
})

let countdownInterval = null
let timerInterval = null
let fallbackPollInterval = null
let refreshTimeout = null
let publicStateFunctionDisabled = false

const PUBLIC_STATE_POLL_MS = 6000
const PUBLIC_STATE_REFRESH_DEBOUNCE_MS = 250

// Mutex to serialize admin _invoke calls and prevent concurrent edge-function storms
let _invokeInFlight = false
const _invokeQueue = []


const syncQueryCache = (snapshot) => {
  queryClient.setQueryData(['game-state'], snapshot)
}

const resolveMyTeam = (state) => {
  if (!state.user?.teamId) return null
  return state.teams.find((team) => team.id === state.user.teamId) || null
}

const getGameTimer = (gameState) => {
  const startedAt = toMillis(gameState.gameStartedAt)
  const pausedAt = toMillis(gameState.pausedAt)

  if (gameState.isGameActive && startedAt) {
    const elapsed = Date.now() - startedAt
    const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0')
    const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0')
    const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  if (gameState.isPaused && startedAt && pausedAt) {
    const elapsed = pausedAt - startedAt
    const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0')
    const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0')
    const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  return '00:00:00'
}

const enforceWagerEliminations = async () => {
  try {
    await supabase.functions.invoke('game-actions', { body: { action: 'enforceWagerEliminations' } })
  } catch (err) {
    console.error('enforceWagerEliminations failed:', err)
  }
}

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
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      _invoke: async (action, payload = {}) => {
        // Serialize all invoke calls to prevent concurrent edge-function storms
        if (_invokeInFlight) {
          return new Promise((resolve) => {
            _invokeQueue.push({ action, payload, resolve })
          })
        }
        _invokeInFlight = true

        const executeInvoke = async (act, pl) => {
          try {
            if (!hasSupabaseConfig) {
              console.error(`Cannot invoke ${act}: Supabase is not configured for this build.`)
              return { success: false, error: 'Supabase is not configured for this build.' }
            }

            const token = get().user?.token

            // Use AbortController with a generous timeout so requests never hang indefinitely
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 20000) // 20s timeout

            let lastError = null
            // Try up to 2 times (initial + 1 retry) for network failures
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const { data, error } = await supabase.functions.invoke('game-actions', {
                  body: { action: act, payload: pl },
                  headers: token ? { 'x-game-token': token } : {},
                })

                clearTimeout(timeoutId)

                if (error) {
                  let errorMessage = error.message;

                  // Extract detailed error from response body if possible
                  if (error.context && typeof error.context.json === 'function') {
                    try {
                      const body = await error.context.json();
                      if (body && (body.error || body.message)) {
                        errorMessage = body.error || body.message;
                      }
                    } catch {
                      // If JSON parsing fails, try text
                      try {
                        const text = await error.context.text();
                        if (text && text.length < 200) errorMessage = text;
                      } catch {
                        // Ignore secondary parse failures and keep the original Supabase error.
                      }
                    }
                  }

                  // Enhanced logging for Vercel/Production
                  console.group(`[ADMIN ACTION ERROR] ${act}`);
                  console.error('Status:', error.status);
                  console.error('Message:', errorMessage);
                  console.error('Original Error:', error);
                  console.groupEnd();

                  // Auto-logout on invalid session token
                  if (errorMessage === 'Invalid session token' || error.status === 401) {
                    get().logout();
                  }

                  // Check if it's a retryable error (network, 5xx)
                  const isRetryable = error.message?.includes('Failed to fetch') ||
                    error.message?.includes('NetworkError') ||
                    error.message?.includes('fetch') ||
                    error.status >= 500
                  if (isRetryable && attempt === 0) {
                    console.warn(`[${act}] Retryable error, attempt ${attempt + 1}:`, errorMessage)
                    lastError = error
                    await new Promise(r => setTimeout(r, 1000)) // Wait 1s before retry
                    continue
                  }
                  return { success: false, error: `${errorMessage}${error.status ? ` (Status: ${error.status})` : ''}` }
                }

                if (data && !data.success) {
                  console.error(`[ADMIN ACTION FAILED] ${act}:`, data.error)
                  if (data.error === 'Invalid session token') {
                    get().logout();
                  }
                  return { success: false, error: data.error }
                }

                // Fire-and-forget: kick off a refetch but don't wait for it
                // This prevents _invoke from hanging if the refetch is slow/blocked
                try {
                  get().triggerFetchPublicState?.()
                } catch {
                  // Mutation success should not fail if a best-effort refetch cannot be scheduled.
                }

                return { success: true, data: data?.data }
              } catch (fetchErr) {
                clearTimeout(timeoutId)
                lastError = fetchErr
                if (fetchErr.name === 'AbortError') {
                  console.error(`[${act}] Request timed out after 20s`)
                  return { success: false, error: 'Request timed out' }
                }
                if (attempt === 0) {
                  console.warn(`[${act}] Network error, retrying in 500ms:`, fetchErr.message)
                  await new Promise(r => setTimeout(r, 500))
                  continue
                }
              }
            }

            // Both attempts failed
            console.error(`Error invoking ${act} after retries:`, lastError)
            return { success: false, error: lastError?.message || 'Network error' }
          } finally {
            // Drain the queue: execute the next queued invoke
            if (_invokeQueue.length > 0) {
              const next = _invokeQueue.shift()
              executeInvoke(next.action, next.payload).then(next.resolve)
            } else {
              _invokeInFlight = false
            }
          }
        }

        return executeInvoke(action, payload)
      },
      login: async (username, password) => {
        const res = await get()._invoke('login', { username, password });
        if (!res.success) return res;

        const { role, token, teamId, teamName } = res.data || {};

        if (role === 'admin') {
          set({ user: { role: 'admin', teamId: null, teamName: null, token } });
          return { success: true, role: 'admin' };
        } else {
          set({ user: { role: 'player', teamId, teamName, avatarSrc: getProfileAvatar(teamName), token } });
          return { success: true, role: 'player', teamId, teamName };
        }
      },
      logout: () => set({ user: null }),
      joinQueue: async () => get()._invoke('joinQueue', { teamId: resolveMyTeam(get())?.id }),
      leaveQueue: async () => get()._invoke('leaveQueue', { teamId: resolveMyTeam(get())?.id }),
      enrollAllEligible: async () => get()._invoke('enrollAllEligible'),
      startGame: async () => get()._invoke('startGame'),
      stopGame: async () => get()._invoke('stopGame'),
      resetGame: async () => get()._invoke('resetGame'),
      togglePhase: async () => get()._invoke('togglePhase'),
      createTeam: async (teamData) => get()._invoke('createTeam', teamData),
      editTeam: async (teamData) => get()._invoke('editTeam', teamData),
      deleteTeam: async (id) => get()._invoke('deleteTeam', { id }),
      updateTokens: async (teamId, amount, reason) => get()._invoke('updateTokens', { teamId, amount, reason }),
      recoverFromTimeout: async (teamId, teamName) => get()._invoke('recoverFromTimeout', { teamId, teamName }),
      createMatch: async (teamAId, teamBId, domain) => get()._invoke('createMatch', { teamAId, teamBId, domain }),
      declareWinner: async (matchId, winnerId) => get()._invoke('declareWinner', { matchId, winnerId }),
      spinDomain: async (matchId, preferredDomain) => get()._invoke('spinDomain', { matchId, preferredDomain }),
      updateDomains: async (domains) => get()._invoke('updateDomains', { domains }),
      setTimeoutDuration: async (durationMs) => get()._invoke('setTimeoutDuration', { durationMs }),
      autoMatchPairs: async () => get()._invoke('autoMatchPairs'),
      endMatchAndStartFinale: async () => get()._invoke('endMatchAndStartFinale'),
      setFinaleDomain: async (domain) => get()._invoke('setFinaleDomain', { domain }),
      declareFinaleRoundWinner: async (winner) => get()._invoke('declareFinaleRoundWinner', { winner }),
      endFinale: async () => get()._invoke('endFinale'),
    }),
    {
      name: 'heist-auth-storage',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
)

const useGameSocketBridge = () => {
  const gameState = useGameStateStore((state) => state.gameState)
  const socketUser = useGameStateStore((state) => state.user)
  const socketTeams = useGameStateStore((state) => state.teams)
  const setGameTimer = useGameStateStore((state) => state.setGameTimer)
  const { isGameActive, isPaused, gameStartedAt, pausedAt } = gameState

  useEffect(() => {
    let channel = null
    let fetchInFlight = false
    let refreshQueued = false

    const fetchPublicStateRowsDirect = async () => {
      const [
        { data: systemRows, error: sysErr },
        { data: teamsRows, error: teamErr },
        { data: queueRows, error: queueErr },
        { data: matchRows, error: matchErr },
        { data: historyRows, error: histErr },
        { data: notificationRows, error: notifErr },
        { data: tokenHistory, error: tokErr }
      ] = await Promise.all([
        supabase.from('system').select('*').eq('key', 'game'),
        supabase.from('teams').select(SAFE_TEAM_COLUMNS).order('name', { ascending: true }),
        supabase.from('matchmaking_queue').select('*'),
        supabase.from('active_matches').select('*'),
        supabase.from('match_history').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('token_history').select('*')
      ])

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
        throw new Error(`Public state fetch failed for ${queryErrors.map(([tableName]) => tableName).join(', ')}`)
      }

      return { systemRows, teamsRows, queueRows, matchRows, historyRows, notificationRows, tokenHistory }
    }

    const fetchPublicStateRows = async () => {
      if (hasSupabaseConfig && !publicStateFunctionDisabled && typeof supabase.functions?.invoke === 'function') {
        const { data, error } = await supabase.functions.invoke('public-state')
        if (!error && data && !data.error) return data

        publicStateFunctionDisabled = true
        console.warn('public-state edge function unavailable; falling back to direct table reads.', error || data?.error)
      }

      return fetchPublicStateRowsDirect()
    }

    const fetchPublicState = async () => {
      if (fetchInFlight) {
        refreshQueued = true
        return
      }

      fetchInFlight = true
      try {
        const publicState = buildPublicStateSnapshot(await fetchPublicStateRows())
        useGameStateStore.getState().applyServerState(publicState)
      } catch (err) {
        console.error('Failed to fetch public state from Supabase', err)
      } finally {
        fetchInFlight = false
        if (refreshQueued) {
          refreshQueued = false
          scheduleRefresh(0)
        }
      }
    }

    const scheduleRefresh = (delay = PUBLIC_STATE_REFRESH_DEBOUNCE_MS) => {
      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        refreshTimeout = null
        fetchPublicState()
      }, delay)
    }

    // Assign fetchPublicState to the store so mutations can trigger it manually for "No Lag" instant updates
    useGameStateStore.setState({ triggerFetchPublicState: fetchPublicState });

    fetchPublicState()

    const tables = ['system', 'teams', 'matchmaking_queue', 'active_matches', 'match_history', 'notifications', 'token_history']
    channel = supabase.channel('public-state')
    tables.forEach((t) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        scheduleRefresh()
      })
    })
    channel.subscribe()

    // Fallback polling keeps UI synced even if realtime is not enabled in Supabase.
    if (fallbackPollInterval) clearInterval(fallbackPollInterval)
    fallbackPollInterval = setInterval(() => scheduleRefresh(0), PUBLIC_STATE_POLL_MS)

    return () => {
      try {
        if (channel) channel.unsubscribe()
      } catch {
        // Ignore unsubscribe errors during route teardown.
      }
      if (fallbackPollInterval) clearInterval(fallbackPollInterval)
      fallbackPollInterval = null
      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = null
      if (countdownInterval) clearInterval(countdownInterval)
      if (timerInterval) clearInterval(timerInterval)
    }
  }, [])

  useEffect(() => {
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = null
    const timerState = { isGameActive, isPaused, gameStartedAt, pausedAt }

    if (isGameActive && gameStartedAt) {
      const tick = () => setGameTimer(getGameTimer(timerState))
      tick()
      timerInterval = setInterval(tick, 1000)
    } else if (isPaused && gameStartedAt && pausedAt) {
      setGameTimer(getGameTimer(timerState))
    } else {
      setGameTimer('00:00:00')
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval)
    }
  }, [isGameActive, isPaused, gameStartedAt, pausedAt, setGameTimer])

  // Real-time timeout recovery interval
  // Use 5s interval (was 1s) to avoid hammering edge functions with concurrent calls
  useEffect(() => {
    let recoveryRunning = false
    const recoveryInterval = setInterval(async () => {
      if (recoveryRunning) return // Skip if previous recovery is still running
      const state = useGameStateStore.getState()
      const now = Date.now()

      if (!state.gameState.isGameActive || state.gameState.isPaused || state.gameState.phase === 'phase2') return

      const myTeam = resolveMyTeam(state)
      const userRole = state.user?.role

      if (myTeam && myTeam.status === 'timeout' && myTeam.timeoutUntil && myTeam.timeoutUntil <= now) {
        recoveryRunning = true
        await state.recoverFromTimeout(myTeam.id, myTeam.name).finally(() => { recoveryRunning = false })
      } else if (userRole === 'admin') {
        const expired = state.teams.filter(t => t.status === 'timeout' && t.timeoutUntil && t.timeoutUntil <= now)
        if (expired.length > 0) {
          recoveryRunning = true
          // Recover one at a time sequentially to avoid flooding the queue
          for (const t of expired) {
            await state.recoverFromTimeout(t.id, t.name)
          }
          recoveryRunning = false
        }
      }
    }, 5000)

    return () => clearInterval(recoveryInterval)
  }, [])

  // Real-time matchmaking engine (Admin only)
  // Use 8s interval (was 3s) to prevent edge-function concurrency storms
  useEffect(() => {
    if (socketUser?.role !== 'admin') return

    let matchmakingRunning = false
    const matchmakingInterval = setInterval(async () => {
      if (matchmakingRunning) return // Skip if previous matchmaking call is still running
      const state = useGameStateStore.getState()
      if (state.gameState.isGameActive && !state.gameState.isPaused) {
        matchmakingRunning = true
        await state.autoMatchPairs().finally(() => { matchmakingRunning = false })
      }
    }, 8000)

    return () => clearInterval(matchmakingInterval)
  }, [socketUser?.role])

  // AUTO-QUEUE: Players are auto-enrolled globally (no need to open Arena)
  useEffect(() => {
    if (socketUser?.role !== 'player') return

    let enrollRunning = false
    const autoEnrollInterval = setInterval(async () => {
      if (enrollRunning) return // Skip if previous enroll call is still running
      const state = useGameStateStore.getState()
      if (!state.gameState.isGameActive || state.gameState.isPaused) return

      const myTeam = resolveMyTeam(state)
      if (!myTeam) return
      if (myTeam.status !== 'idle') return
      if (myTeam.tokens <= 0 || myTeam.status === 'eliminated') return

      // Check if already in queue
      const alreadyInQueue = (state.matchmakingQueue || []).some(
        (q) => (q.teamId || q.team_id) === myTeam.id
      )
      if (alreadyInQueue) return

      // Check if already in an active match
      const inMatch = (state.activeMatches || []).some((m) => {
        const aId = m.team_a || m.teamA?.id
        const bId = m.team_b || m.teamB?.id
        return aId === myTeam.id || bId === myTeam.id
      })
      if (inMatch) return

      enrollRunning = true
      await state.joinQueue().finally(() => { enrollRunning = false })
    }, 5000) // Check every 5 seconds (was 2s)

    return () => clearInterval(autoEnrollInterval)
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
    return buildReadyQueuePairs({
      gameState: state.gameState,
      teams: state.teams,
      matchmakingQueue: state.matchmakingQueue,
      matchConstraints: state.matchConstraints,
      activeMatches: state.activeMatches,
    })
  }, [state.activeMatches, state.gameState, state.matchConstraints, state.matchmakingQueue, state.teams])

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
