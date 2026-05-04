import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const GameStateContext = createContext(null);
const socket = io('http://localhost:3001');

export const GameStateProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [state, setState] = useState({
    gameState: { isGameActive: false, isPaused: false, gameStartedAt: null, pausedAt: null, phase: 'phase1', status: 'not_started' },
    teams: [],
    matchmakingQueue: [],
    activeMatches: [],
    matchHistory: [],
    notifications: [],
    tokenHistory: [],
    matchConstraints: {}
  });

  const [countdown, setCountdown] = useState(null);
  const [gameTimer, setGameTimer] = useState('00:00:00');
  const countdownRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    socket.on('stateUpdate', (newState) => setState(newState));

    socket.on('gameReset', () => {
      setUser(null);
      setCountdown(null);
      setState({
        gameState: { isGameActive: false, isPaused: false, gameStartedAt: null, pausedAt: null, phase: 'phase1', status: 'not_started' },
        teams: [], matchmakingQueue: [], activeMatches: [], matchHistory: [],
        notifications: [], tokenHistory: [], matchConstraints: {}
      });
    });

    socket.on('countdown', ({ seconds }) => {
      setCountdown(seconds);
      let remaining = seconds;
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) { clearInterval(countdownRef.current); setCountdown(null); }
        else setCountdown(remaining);
      }, 1000);
    });

    socket.on('gameStarted', () => setCountdown(null));
    socket.on('countdownCancelled', () => {
      setCountdown(null);
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    });

    return () => {
      socket.off('stateUpdate'); socket.off('gameReset'); socket.off('countdown');
      socket.off('gameStarted'); socket.off('countdownCancelled');
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Game timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (state.gameState.isGameActive && state.gameState.gameStartedAt) {
      const tick = () => {
        const elapsed = Date.now() - state.gameState.gameStartedAt;
        const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
        const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
        const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
        setGameTimer(`${hrs}:${mins}:${secs}`);
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else if (state.gameState.isPaused && state.gameState.gameStartedAt && state.gameState.pausedAt) {
      const elapsed = state.gameState.pausedAt - state.gameState.gameStartedAt;
      const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
      const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
      const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
      setGameTimer(`${hrs}:${mins}:${secs}`);
    } else {
      setGameTimer('00:00:00');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.gameState.isGameActive, state.gameState.isPaused, state.gameState.gameStartedAt, state.gameState.pausedAt]);

  const login = useCallback((username, password) => {
    return new Promise((resolve) => {
      socket.emit('login', { username, password }, (response) => {
        if (response.success) setUser({ role: response.role, teamId: response.teamId, teamName: response.teamName });
        resolve(response);
      });
    });
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const myTeam = useMemo(() => {
    if (!user || !user.teamId) return null;
    return state.teams.find(t => t.id === user.teamId) || null;
  }, [state.teams, user]);

  const sortedLeaderboard = useMemo(() => {
    return [...state.teams].sort((a, b) => {
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      return (a.lastTokenUpdateTime || 0) - (b.lastTokenUpdateTime || 0);
    });
  }, [state.teams]);

  const currentActiveMatch = useMemo(() => {
    if (!myTeam) return null;
    return state.activeMatches.find(m => m.teamA.id === myTeam.id || m.teamB.id === myTeam.id) || null;
  }, [state.activeMatches, myTeam]);

  const isInQueue = useMemo(() => {
    if (!myTeam) return false;
    return (state.matchmakingQueue || []).some(q => q.teamId === myTeam.id);
  }, [state.matchmakingQueue, myTeam]);

  const myQueueEntry = useMemo(() => {
    if (!myTeam) return null;
    return (state.matchmakingQueue || []).find(q => q.teamId === myTeam.id) || null;
  }, [state.matchmakingQueue, myTeam]);

  const queuePairs = useMemo(() => {
    const q = state.matchmakingQueue || [];
    return q.filter(e => e.matchedWith).reduce((pairs, e) => {
      const partner = q.find(x => x.teamId === e.matchedWith);
      if (partner && !pairs.find(p => p.teamAId === e.matchedWith)) {
        pairs.push({ teamAId: e.teamId, teamAName: e.teamName, teamBId: partner.teamId, teamBName: partner.teamName });
      }
      return pairs;
    }, []);
  }, [state.matchmakingQueue]);

  const value = {
    ...state, user, myTeam, countdown, gameTimer, sortedLeaderboard,
    currentActiveMatch, isInQueue, myQueueEntry, queuePairs,
    login, logout,
    // Player Actions
    joinQueue: () => { if (myTeam) socket.emit('joinQueue', { teamId: myTeam.id }); },
    leaveQueue: () => { if (myTeam) socket.emit('leaveQueue', { teamId: myTeam.id }); },
    // Admin Actions
    startGame: () => socket.emit('startGame'),
    stopGame: () => socket.emit('stopGame'),
    resetGame: () => socket.emit('resetGame'),
    togglePhase: () => socket.emit('togglePhase'),
    createTeam: (teamData) => socket.emit('createTeam', teamData),
    editTeam: (teamData) => socket.emit('editTeam', teamData),
    deleteTeam: (id) => socket.emit('deleteTeam', id),
    updateTokens: (teamId, amount, reason) => socket.emit('updateTokens', { teamId, amount, reason }),
    createMatch: (teamAId, teamBId, domain) => new Promise(resolve => socket.emit('createMatch', { teamAId, teamBId, domain }, resolve)),
    declareWinner: (matchId, winnerId) => socket.emit('declareWinner', { matchId, winnerId }),
    spinDomain: (matchId, preferredDomain) => new Promise(resolve => socket.emit('spinDomain', { matchId, preferredDomain }, resolve)),
    updateDomains: (domains) => socket.emit('updateDomains', domains),
    setTimeoutDuration: (durationMs) => socket.emit('setTimeoutDuration', durationMs),
  };

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
};
