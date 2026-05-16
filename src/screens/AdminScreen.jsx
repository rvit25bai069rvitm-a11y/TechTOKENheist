import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '../hooks/useGameState';
import { hasSupabaseConfig } from '../lib/supabase';
import {
  VenetianMask, Banknote, Lock, Bomb, Users, Search, Flame, Settings,
  Plus, X, Fingerprint, Wallet, Map, ScrollText, Crown, Zap, AlertTriangle, Clock,
  Skull, Trophy, Swords, Activity
} from 'lucide-react';
import DomainWheel from '../components/DomainWheel';
import { buildQueueDiagnostics } from '../utils/matchmaking';
import { PROFILE_AVATARS, DEFAULT_PROFILE_NAME, getProfileAvatar, getProfileLabel } from '../data/profileAvatars';
import './AdminScreen.css';

const CUSTOM_PROFILE_VALUE = '__custom__';

const MatchTimer = ({ startTime }) => {
  const [display, setDisplay] = useState('0:00');
  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - startTime;
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setDisplay(`${mins}:${String(secs).padStart(2, '0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  return <div className="heist-mono text-heist-yellow">{display}</div>;
};

const TimeoutDisplay = ({ timeoutUntil }) => {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, timeoutUntil - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timeoutUntil]);
  return <span className="heist-mono text-gray-400 bg-gray-900 px-2 border border-gray-600">{remaining}</span>;
};

const AdminScreen = () => {
  const {
    gameState, gameTimer, teams, matchmakingQueue, activeMatches, matchHistory,
    notifications, queuePairs, matchConstraints,
    startGame, stopGame, resetGame, togglePhase, createTeam, deleteTeam,
    updateTokens, createMatch, declareWinner, spinDomain, updateDomains, setTimeoutDuration,
    autoMatchPairs,
    endMatchAndStartFinale, setFinaleDomain,
    declareFinaleRoundWinner, endFinale,
    _invoke
  } = useGameState();

  const [diagResult, setDiagResult] = useState(null);

  const runDiagnostics = async () => {
    setActionInProgress('diag');
    setDiagResult('Testing connection...');
    try {
      const res = await _invoke('healthCheck');
      if (res.success) {
        setDiagResult(`CONNECTED: System is ${res.data?.systemStatus || 'ACTIVE'}`);
      } else {
        setDiagResult(`FAILED: ${res.error}`);
      }
    } catch (err) {
      setDiagResult(`CRITICAL ERROR: ${err.message}`);
    } finally {
      setActionInProgress(null);
      setTimeout(() => setDiagResult(null), 5000);
    }
  };

  const [tab, setTab] = useState('teams');
  const [selectedProfile, setSelectedProfile] = useState(() => PROFILE_AVATARS[0]?.name || '');
  const [customTeamName, setCustomTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberNames, setMemberNames] = useState([]);
  const [leader, setLeader] = useState('');

  const [actionInProgress, setActionInProgress] = useState(null); // track which action is running
  const [lastError, setLastError] = useState(null);

  const safeAction = async (name, fn) => {
    if (actionInProgress) return; 
    setActionInProgress(name);
    setLastError(null);
    try {
      const res = await fn();
      if (res && res.success === false) {
        setLastError({ action: name, message: res.error || 'Unknown error occurred' });
        console.error(`[ADMIN] ${name} failed:`, res.error);
      }
    } catch (err) {
      console.error(`[ADMIN] System Error in ${name}:`, err);
      setLastError({ action: name, message: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  const [logFilter, setLogFilter] = useState('all'); // 'all', 'matches', 'admin'

  const [domainInput, setDomainInput] = useState('');
  const [timeoutInput, setTimeoutInput] = useState('');
  const [selectedFinaleDomain, setSelectedFinaleDomain] = useState('');

  const domains = useMemo(
    () => gameState.domains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'],
    [gameState.domains]
  );
  const assignedProfiles = useMemo(
    () => new Set((teams || []).map((team) => String(team.name || '').trim().toLowerCase())),
    [teams]
  );
  const finaleDomains = useMemo(
    () => gameState.finaleState?.finaleDomains || [],
    [gameState.finaleState?.finaleDomains]
  );
  const currentFinaleDomain = gameState.finaleState?.currentDomain || '';
  const finaleRound = (gameState.finaleState?.currentRound || 0) + 1;
  const finaleActive = Boolean(gameState.finaleState?.isFinaleActive);
  const roundStartedAt = gameState.finaleState?.roundStartedAt || null;
  const availableFinaleDomains = useMemo(() => {
    const used = new Set([...(finaleDomains || []), gameState.finaleState?.currentDomain].filter(Boolean));
    return domains.filter((domain) => !used.has(domain));
  }, [domains, finaleDomains, gameState.finaleState?.currentDomain]);

  const addMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed || memberNames.length >= 4 || memberNames.includes(trimmed)) return;
    setMemberNames((prev) => [...prev, trimmed]);
    setMemberInput('');
  };

  const removeMember = (indexToRemove) => {
    const removedName = memberNames[indexToRemove];
    const updated = memberNames.filter((_, idx) => idx !== indexToRemove);
    setMemberNames(updated);
    if (leader === removedName) setLeader('');
  };

  const [confirmConfig, setConfirmConfig] = useState(null);
  const [pendingDomainConfirm, setPendingDomainConfirm] = useState(null);

  const handleDeleteTeam = (team) => {
    if (!team?.id) return;
    setConfirmConfig({
      title: 'DELETE PROFILE',
      message: `Remove ${team.name || 'this profile'} from the recruit list? This cannot be undone.`,
      type: 'danger',
      onConfirm: () => safeAction(`deleteTeam:${team.id}`, () => deleteTeam(team.id)),
    });
  };

  const handleCreateTeam = (e) => {
    e.preventDefault();
    const isCustom = selectedProfile === CUSTOM_PROFILE_VALUE;
    const teamName = isCustom ? customTeamName.trim() : selectedProfile;

    if (!teamName) { alert('Missing team name/profile'); return; }
    if (!teamPassword) { alert('Missing security key (password)'); return; }
    if (memberNames.length < 1) { alert('Add at least one member'); return; }
    if (!leader) { alert('Select a crew leader from the dropdown'); return; }

    safeAction('createTeam', () => createTeam({ name: teamName, memberNames, leader, password: teamPassword }));
    setTeamPassword('');
    setCustomTeamName('');
    setMemberInput('');
    setMemberNames([]);
    setLeader('');
  };

  const selectedProfileLabel = selectedProfile === CUSTOM_PROFILE_VALUE
    ? 'Custom (Default Avatar)'
    : getProfileLabel(selectedProfile);

  const selectedProfileAvatar = selectedProfile === CUSTOM_PROFILE_VALUE
    ? getProfileAvatar(DEFAULT_PROFILE_NAME)
    : getProfileAvatar(selectedProfile);

  const handleSpinForMatch = async (matchId, preferredDomain) => {
    const result = await spinDomain(matchId, preferredDomain);
    return result;
  };

  const handleQueueDomainSpin = (pair, domain) => {
    if (!pair || !domain) return;
    setPendingDomainConfirm({ pair, domain });
  };

  const handleContinueToVaults = () => {
    const pair = pendingDomainConfirm?.pair;
    const domain = pendingDomainConfirm?.domain;
    if (!pair || !domain) return;

    safeAction(`createMatch:${pair.teamAId}:${pair.teamBId}`, async () => {
      const result = await createMatch(pair.teamAId, pair.teamBId, domain);
      if (!result || result.success !== false) {
        setPendingDomainConfirm(null);
      }
      return result;
    });
  };

  const handleDeclareWinner = (match, winningTeam) => {
    if (!match?.id || !winningTeam?.id) return;
    if (!window.confirm(`Confirm winner declaration for ${winningTeam.name}?`)) return;
    safeAction(`declareWinner:${match.id}`, () => declareWinner(match.id, winningTeam.id));
  };

  const updateTimeout = (minutes) => {
    if (minutes === null) {
      setTimeoutDuration(null);
    } else {
      setTimeoutDuration(minutes * 60000);
    }
  };

  const waitingQueue = useMemo(
    () => (matchmakingQueue || []).filter((q) => !q.matchedWith),
    [matchmakingQueue]
  );

  const queueDiagnostics = useMemo(
    () => buildQueueDiagnostics({ gameState, teams, matchmakingQueue, matchConstraints, activeMatches }),
    [activeMatches, gameState, teams, matchmakingQueue, matchConstraints]
  );

  useEffect(() => {
    if (!pendingDomainConfirm?.pair) return undefined;
    const stillReady = queuePairs.some(
      (pair) => pair.teamAId === pendingDomainConfirm.pair.teamAId && pair.teamBId === pendingDomainConfirm.pair.teamBId
    );
    if (stillReady) return undefined;

    const timeoutId = setTimeout(() => setPendingDomainConfirm(null), 0);
    return () => clearTimeout(timeoutId);
  }, [pendingDomainConfirm, queuePairs]);

  const tabs = [
    { id: 'teams', label: 'TEAMS', icon: <Users size={20} /> },
    { id: 'ranking', label: 'RANKING', icon: <Crown size={20} /> },
    { id: 'queue', label: 'PLANS', icon: <Search size={20} /> },
    { id: 'fighting', label: 'VAULTS', icon: <Flame size={20} /> },
    { id: 'finale', label: 'FINALE', icon: <Trophy size={20} /> },
    { id: 'logs', label: 'LOGS', icon: <ScrollText size={20} /> },
    { id: 'settings', label: 'SCHEMATICS', icon: <Settings size={20} /> },
  ];

  const sortedLeaderboard = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      return (a.lastTokenUpdateTime || 0) - (b.lastTokenUpdateTime || 0);
    });
  }, [teams]);

  const filteredNotifications = useMemo(() => {
    if (logFilter === 'all') return notifications;
    if (logFilter === 'matches') return notifications.filter(n => n.message.includes('Match') || n.message.includes('defeated'));
    if (logFilter === 'admin') return notifications.filter(n => n.message.includes('Admin') || n.message.includes('System') || n.message.includes('Command'));
    return notifications;
  }, [notifications, logFilter]);

  const telemetryLogs = useMemo(() => {
    return [...notifications].reverse();
  }, [notifications]);

  useEffect(() => {
    const shouldClear =
      currentFinaleDomain ||
      (selectedFinaleDomain && !availableFinaleDomains.includes(selectedFinaleDomain));
    if (!shouldClear) return undefined;

    const timeoutId = setTimeout(() => setSelectedFinaleDomain(''), 0);
    return () => clearTimeout(timeoutId);
  }, [selectedFinaleDomain, availableFinaleDomains, currentFinaleDomain]);

  return (
    <div className="min-h-screen heist-bg p-4 sm:p-6 lg:p-8 text-white relative flex flex-col gap-3 pb-20 overflow-hidden">
      <div className="graffiti text-8xl top-20 left-10 transform -rotate-12">BELLA CIAO</div>
      <div className="graffiti text-6xl bottom-40 right-10 transform rotate-12">RESISTANCE</div>
      <div className="graffiti text-5xl top-1/2 left-1/3 transform -rotate-6 opacity-[0.03]">EL PROFESOR</div>

      {/* Top Navbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 relative z-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-heist-red rounded-full flex items-center justify-center border-2 border-black shadow-lg flex-shrink-0">
            <VenetianMask className="text-black" size={32} />
          </div>
          <div className="flex flex-col">
            <h1 className="heist-font text-heist-red text-4xl sm:text-5xl m-0 leading-none drop-shadow-md">THE PROFESSOR'S DIRECTORY</h1>
            <span className="heist-mono text-gray-400 text-xs sm:text-sm tracking-widest uppercase mt-1">ROYAL MINT OPERATIONS</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 border border-heist-teal px-4 py-2 bg-black bg-opacity-70 shadow-inner flex-1 justify-center md:flex-none">
            <span className="heist-font text-heist-teal tracking-widest text-lg md:text-xl">
              {gameState.phase === 'phase2' ? 'WAGER MODE' : 'PHASE 1 — INFILTRATION'}
            </span>
            <Banknote className="text-heist-teal" size={20} />
          </div>
          <button
            className={`border border-heist-red text-heist-red px-4 py-2 heist-font text-lg md:text-xl tracking-widest hover:bg-heist-red hover:text-black transition-colors flex-1 md:flex-none ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
            onClick={() => setConfirmConfig({
              title: 'ABORT MISSION',
              message: 'This will wipe all active matches and reset the operation. Are you sure?',
              type: 'danger',
              verificationText: 'rvitmkimkc',
              onConfirm: () => safeAction('abortMission', resetGame)
            })}
            disabled={!!actionInProgress}
          >
            {actionInProgress === 'abortMission' ? 'ABORTING...' : 'ABORT MISSION'}
          </button>
        </div>
      </div>

      {/* Operation Command */}
      <div className="panel-container border-2 border-heist-red p-4 flex flex-col xl:flex-row items-center justify-between relative z-10 gap-4">
        <div className="flex items-center gap-4 w-full xl:w-auto justify-center xl:justify-start">
          <div className="w-16 h-16 border border-heist-red rounded-full flex items-center justify-center p-2 flex-shrink-0">
            <VenetianMask className="text-heist-red" size={36} />
          </div>
          <div className="flex flex-col">
            <h2 className="heist-font text-white text-3xl leading-none tracking-wider">OPERATION</h2>
            <h2 className="heist-font text-white text-3xl leading-none tracking-wider">COMMAND</h2>
          </div>
        </div>
        <div className="flex flex-col items-center xl:items-end gap-3 w-full xl:w-auto">
          <div className="flex flex-wrap justify-center xl:justify-end gap-2 w-full">
            <button
              className={`px-6 py-2 heist-font text-xl tracking-wider min-w-[120px] transition-colors ${gameState.isPaused || !gameState.isGameActive ? 'bg-heist-red text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'} ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => setConfirmConfig({
                title: 'HOLD MISSION',
                message: 'This will pause all active operations and timers. Proceed?',
                type: 'warning',
                onConfirm: () => safeAction('stopGame', stopGame)
              })}
              disabled={!!actionInProgress}
            >
              {actionInProgress === 'stopGame' ? 'HOLDING...' : 'ON HOLD'}
            </button>
            <button className="px-6 py-2 bg-heist-teal text-black heist-font text-xl tracking-wider flex items-center gap-2 min-w-[120px]">
              PHASE {gameState.phase === 'phase2' ? '2' : '1'} <Banknote size={20} />
            </button>
            <button
              className={`px-6 py-2 heist-font text-xl tracking-wider flex items-center gap-2 min-w-[160px] transition-colors ${gameState.isGameActive && !gameState.isPaused ? 'bg-heist-yellow text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'} ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => setConfirmConfig({
                title: 'EXECUTE PLAN',
                message: 'Initiate mission and activate all field operations?',
                type: 'success',
                onConfirm: () => safeAction('startGame', startGame)
              })}
              disabled={!!actionInProgress}
            >
              {actionInProgress === 'startGame' ? 'EXECUTING...' : 'EXECUTE PLAN'} <Lock size={20} />
            </button>
          </div>
          <div className="flex gap-2 relative mt-2 xl:mt-0">
            <button
              className={`border border-heist-red text-heist-red px-6 py-1 heist-font text-lg hover:bg-heist-red hover:text-black transition-colors ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => setConfirmConfig({
                title: 'RESET PARAMETERS',
                message: 'This will reset all team tokens and status. This action is irreversible!',
                type: 'danger',
                verificationText: 'rvitmkimkc',
                onConfirm: () => safeAction('resetGame', resetGame)
              })}
              disabled={!!actionInProgress}
            >
              {actionInProgress === 'resetGame' ? 'RESETTING...' : 'RESET PARAMETERS'}
            </button>
            <div className="absolute -bottom-5 left-0 heist-mono text-[9px] text-gray-600 uppercase tracking-widest">
              RESET KEY: rvitmkimkc
            </div>
            <button
              className={`border-2 border-orange-500 text-orange-500 px-6 py-1 heist-font text-lg hover:bg-orange-500 hover:text-black transition-colors animate-pulse ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => setConfirmConfig({
                title: 'END MATCH & START FINALE',
                message: 'This will terminate all ongoing matches and lock the leaderboard for the Finale. Proceed?',
                type: 'danger',
                onConfirm: () => safeAction('endMatch', endMatchAndStartFinale)
              })}
              disabled={!!actionInProgress}
            >
              <span className="flex items-center gap-2"><Skull size={18} /> {actionInProgress === 'endMatch' ? 'ENDING...' : 'END MATCH'}</span>
            </button>
            <span className="absolute -bottom-3 -right-2 bg-heist-red text-black text-[10px] heist-font px-1 transform rotate-6 border border-black shadow-sm flex items-center gap-1">
              <AlertTriangle size={10} /> CONFIRM!
            </span>
          </div>
        </div>
      </div>

      {/* Phase Status */}
      <div className="panel-container border-2 border-heist-teal p-4 flex flex-col md:flex-row justify-between items-center relative z-10 gap-4 mt-2">
        <div className="flex items-center gap-4 w-full">
          <Zap className="text-heist-teal flex-shrink-0" size={32} />
          <div className="flex-1 md:flex-none flex flex-col gap-2">
            <h2 className="heist-font text-2xl tracking-widest text-white m-0">MISSION CONTROL</h2>
            {lastError && (
              <div className="bg-heist-red/10 border border-heist-red/50 p-2 flex items-center gap-2 animate-in slide-in-from-top-1">
                <AlertTriangle size={14} className="text-heist-red shrink-0" />
                <span className="heist-mono text-[10px] text-heist-red uppercase">
                  ERROR IN {lastError.action}: {lastError.message}
                </span>
                <button onClick={() => setLastError(null)} className="ml-auto text-heist-red/50 hover:text-heist-red">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="heist-font text-2xl tracking-wider text-white">
              {gameState.phase === 'phase2' ? 'WAGER MODE ACTIVATED' : 'PHASE 1 — INFILTRATION'}
            </div>
            <div className="heist-mono text-sm text-gray-400 mt-1">
              Queue match: Vault 13A infiltration. Stake: {gameState.phase === 'phase2' ? 'Winner takes all' : '+1/-1 TKN'}. Timeout: {gameState.timeoutDurationOverride ? gameState.timeoutDurationOverride / 60000 : 15} minutes.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border border-heist-yellow bg-black bg-opacity-70 px-4 py-2 shadow-inner">
          <Clock className="text-heist-yellow flex-shrink-0" size={22} />
          <div className="flex flex-col leading-none">
            <span className="heist-mono text-[10px] uppercase tracking-[0.3em] text-gray-400">Game Timer</span>
            <span className="heist-font text-3xl tracking-wider text-heist-yellow tabular-nums">{gameTimer}</span>
          </div>
        </div>
        <button
          className={`bg-heist-teal text-black px-6 py-2 heist-font text-xl flex items-center justify-center gap-2 hover:bg-white transition-colors w-full md:w-auto flex-shrink-0 ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
          onClick={() => setConfirmConfig({
            title: gameState.phase === 'phase2' ? 'REVERT TO PHASE 1' : 'INITIATE WAGER MODE',
            message: gameState.phase === 'phase2' ? 'Switch back to standard match mode?' : 'Switch to WAGER mode? This will reset match history and enable high-stakes eliminations.',
            type: 'warning',
            onConfirm: () => safeAction('togglePhase', togglePhase)
          })}
          disabled={!!actionInProgress}
        >
          {actionInProgress === 'togglePhase' ? 'SWITCHING...' : (gameState.phase === 'phase2' ? 'REVERT PHASE' : 'INITIATE WAGER MODE')} <Bomb size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-4 relative z-10 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`flex-1 min-w-[120px] py-3 heist-font text-xl tracking-wider border-2 flex items-center justify-center gap-2 transition-colors ${tab === t.id ? 'bg-heist-yellow text-black border-heist-yellow' : 'bg-[#151515] text-gray-400 border-[#222] hover:bg-[#222]'}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 min-h-[500px]">

        {/* TEAMS TAB */}
        {tab === 'teams' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Left Panel - Create */}
            <div className="panel-container border-2 border-heist-teal p-6 relative overflow-hidden flex flex-col">
              <Fingerprint className="absolute -right-10 top-10 w-64 h-64 text-heist-teal opacity-10 pointer-events-none" />
              <h3 className="heist-font text-heist-teal text-3xl mb-2 tracking-wider">ASSIGN PROFILE</h3>
              <p className="heist-mono text-gray-400 text-xs uppercase mb-6">One crew per predefined avatar, or use Custom with default profile.</p>
              <form onSubmit={handleCreateTeam} className="flex flex-col gap-5 relative z-10">
                <div className="flex flex-col gap-1">
                  <label className="heist-font text-heist-teal tracking-widest text-lg">PROFILE NAME</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                    {PROFILE_AVATARS.map((profile) => {
                      const isSelected = selectedProfile === profile.name;
                      const isAssigned = assignedProfiles.has(profile.name);

                      return (
                        <button
                          key={profile.name}
                          type="button"
                          onClick={() => setSelectedProfile(profile.name)}
                          className={`border text-left p-2 transition-all ${isSelected ? 'border-heist-yellow bg-heist-yellow bg-opacity-10' : isAssigned ? 'border-heist-teal bg-black bg-opacity-70 hover:border-white' : 'border-gray-700 bg-black bg-opacity-50 hover:border-heist-teal'}`}
                        >
                          <div className="w-full aspect-square rounded-full overflow-hidden border border-gray-700 mb-2 bg-black">
                            <img src={profile.avatar} alt={profile.label} className="w-full h-full object-cover" />
                          </div>
                          <div className="heist-font text-sm tracking-widest text-white leading-none">{profile.label}</div>
                          <div className={`heist-mono text-[10px] uppercase mt-1 ${isAssigned ? 'text-heist-yellow' : 'text-gray-500'}`}>
                            {isAssigned ? 'Configured' : 'Available'}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedProfile(CUSTOM_PROFILE_VALUE)}
                      className={`border text-left p-2 transition-all ${selectedProfile === CUSTOM_PROFILE_VALUE ? 'border-heist-yellow bg-heist-yellow bg-opacity-10' : 'border-gray-700 bg-black bg-opacity-50 hover:border-heist-teal'}`}
                    >
                      <div className="w-full aspect-square rounded-full overflow-hidden border border-gray-700 mb-2 bg-black">
                        <img src={getProfileAvatar(DEFAULT_PROFILE_NAME)} alt="Custom Team" className="w-full h-full object-cover" />
                      </div>
                      <div className="heist-font text-sm tracking-widest text-white leading-none">Custom</div>
                      <div className="heist-mono text-[10px] uppercase mt-1 text-gray-500">Default Avatar</div>
                    </button>
                  </div>
                </div>
                {selectedProfile === CUSTOM_PROFILE_VALUE && (
                  <div className="flex flex-col gap-1">
                    <label className="heist-font text-heist-teal tracking-widest text-lg">TEAM NAME</label>
                    <input className="input-heist" value={customTeamName} onChange={e => setCustomTeamName(e.target.value)} placeholder="e.g., phoenix_squad" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="heist-font text-heist-teal tracking-widest text-lg">PASSWORD</label>
                  <input className="input-heist" value={teamPassword} onChange={e => setTeamPassword(e.target.value)} placeholder="e.g., Secret Passcode (use non-alphanumeric char)" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="heist-font text-heist-teal tracking-widest text-lg">MEMBERS ({memberNames.length}/4)</label>
                  <div className="flex gap-2">
                    <input className="input-heist" value={memberInput} onChange={e => setMemberInput(e.target.value)} placeholder="Add member name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }} />
                    <button type="button" onClick={addMember} className="bg-[#ccc] text-black w-12 flex items-center justify-center font-bold text-2xl hover:bg-white transition-colors" disabled={memberNames.length >= 4}>+</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {memberNames.map((member, idx) => (
                      <div key={member} className="heist-mono text-sm border border-gray-600 px-2 py-1 flex items-center gap-2 bg-black bg-opacity-50">
                        {member} <X size={14} className="cursor-pointer text-heist-red hover:text-white" onClick={() => removeMember(idx)} />
                      </div>
                    ))}
                  </div>
                </div>
                {memberNames.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="heist-font text-heist-teal tracking-widest text-lg">SELECT LEADER</label>
                    <select className="input-heist cursor-pointer bg-black" value={leader} onChange={e => setLeader(e.target.value)}>
                      <option value="">Choose Leader...</option>
                      {memberNames.map((member) => <option key={member} value={member}>{member}</option>)}
                    </select>
                  </div>
                )}
                <div className="heist-mono text-[11px] text-gray-500 uppercase border border-gray-800 bg-black bg-opacity-60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700 bg-black flex-shrink-0">
                      <img src={selectedProfileAvatar} alt={selectedProfileLabel} className="w-full h-full object-cover" />
                    </div>
                    <span>Selected: <span className="text-white">{selectedProfileLabel}</span></span>
                  </div>
                </div>
                <button 
                  type="submit" 
                  className="mt-4 bg-[#bbb] text-black py-3 heist-font text-xl tracking-wider flex items-center justify-center gap-2 hover:bg-white transition-colors"
                >
                  + CREATE TEAM <Wallet size={20} />
                </button>
              </form>
            </div>

            {/* Right Panel - List */}
            <div className="panel-container border-2 border-[#333] p-6 relative overflow-hidden flex flex-col bg-blueprint">
              <h3 className="heist-font text-white text-3xl mb-6 tracking-wider relative z-10">ALL RECRUITS ({teams.length})</h3>

              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 relative z-10">
                {teams.length === 0 && (
                  <div className="heist-mono text-gray-400 mt-4">
                    No members recruited yet. Awaiting briefing.
                  </div>
                )}
                {teams.map(t => (
                  <div key={t.id} className="border border-gray-700 bg-black bg-opacity-80 p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:border-gray-500 transition-colors">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700 bg-black flex-shrink-0">
                          <img src={t.avatarSrc} alt={getProfileLabel(t.name)} className="w-full h-full object-cover" />
                        </div>
                        <span className={`heist-font text-2xl tracking-wider ${t.status === 'eliminated' ? 'text-heist-red line-through' : t.status === 'timeout' ? 'text-gray-500' : 'text-white'}`}>{t.name}</span>
                        <span className={`heist-mono text-[10px] px-1 py-0.5 border ${t.status === 'eliminated' ? 'border-heist-red text-heist-red' : t.status === 'finalist' ? 'border-orange-500 text-orange-500' : t.status === 'spectating' ? 'border-gray-500 text-gray-300' : t.status === 'idle' ? 'border-heist-yellow text-heist-yellow' : t.status === 'fighting' ? 'border-heist-red bg-heist-red text-white' : 'border-gray-500 text-gray-400'}`}>
                          {t.status.toUpperCase()}
                        </span>
                        {t.status === 'timeout' && t.timeoutUntil && <TimeoutDisplay timeoutUntil={t.timeoutUntil} />}
                      </div>
                      <div className="heist-mono text-xs text-gray-400 mt-2 leading-relaxed break-words">
                        <div><span className="text-gray-500 uppercase">Leader:</span> <span className="text-gray-300">{t.leader || 'Unassigned'}</span></div>
                        <div><span className="text-gray-500 uppercase">Members:</span> <span className="text-gray-300">{(t.memberNames || []).length ? t.memberNames.join(', ') : 'No members listed'}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t border-gray-800 sm:border-0 pt-3 sm:pt-0">
                      <span className="heist-font text-heist-yellow text-2xl">{t.tokens} TKN</span>
                      <div className="flex items-center gap-1 bg-[#111] p-1 border border-gray-800">
                        <button onClick={() => updateTokens(t.id, 1, 'Admin')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-heist-yellow hover:bg-gray-800 transition-colors">+</button>
                        <button onClick={() => updateTokens(t.id, -1, 'Admin')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-heist-red hover:bg-gray-800 transition-colors">-</button>
                        <button onClick={() => handleDeleteTeam(t)} className="w-8 h-8 flex items-center justify-center text-heist-red hover:bg-heist-red hover:text-white transition-colors ml-1"><X size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-10 right-10 opacity-[0.03] pointer-events-none">
                <div className="heist-mono text-sm text-center mb-2">Royal Mint's security grid</div>
                <Map size={200} />
              </div>
            </div>
          </div>
        )}

        {/* QUEUE TAB (PLANS) */}
        {tab === 'queue' && (
          <div className="panel-container border-2 border-[#333] p-6 h-full flex flex-col bg-blueprint">
            <h3 className="heist-font text-white text-3xl mb-6 tracking-wider">MATCHMAKING PLANS</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2 pb-10">
              {/* Ready Pairs */}
              <div className="flex flex-col gap-4">
                <h4 className="heist-font text-heist-yellow text-2xl tracking-wider border-b border-gray-700 pb-2">READY TO EXECUTE</h4>
                {queuePairs.length === 0 && <div className="heist-mono text-gray-500">No ready pairs currently.</div>}
                {queuePairs.map((pair, i) => {
                  const isPendingForPair =
                    pendingDomainConfirm?.pair?.teamAId === pair.teamAId &&
                    pendingDomainConfirm?.pair?.teamBId === pair.teamBId;
                  const createActionName = `createMatch:${pair.teamAId}:${pair.teamBId}`;

                  return (
                    <div key={i} className="border border-heist-yellow bg-black bg-opacity-80 p-4">
                      <div className="heist-font text-2xl text-center mb-4 flex items-center justify-center gap-4">
                        <span className="text-white">{pair.teamAName}</span>
                        <span className="text-heist-red">VS</span>
                        <span className="text-white">{pair.teamBName}</span>
                      </div>
                      <div className="flex justify-center border-t border-gray-800 pt-4">
                        <DomainWheel
                          domains={domains}
                          disabled={Boolean(pendingDomainConfirm) || actionInProgress === createActionName}
                          onSpin={(domain) => handleQueueDomainSpin(pair, domain)}
                        />
                      </div>

                      {isPendingForPair && (
                        <div className="mt-4 border-t border-heist-yellow/50 pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
                          <div className="flex-1 min-w-0">
                            <label className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest block mb-2">
                              Confirm Domain
                            </label>
                            <select
                              className="input-heist w-full"
                              value={pendingDomainConfirm.domain}
                              onChange={(e) => setPendingDomainConfirm((current) => ({ ...current, domain: e.target.value }))}
                            >
                              {domains.map((domain) => (
                                <option key={domain} value={domain}>{domain}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            className="bg-heist-yellow text-black px-4 py-3 heist-font tracking-widest hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-wait transition-colors"
                            onClick={handleContinueToVaults}
                            disabled={!!actionInProgress}
                          >
                            {actionInProgress === createActionName ? 'SENDING...' : 'CONTINUE TO VAULTS'}
                          </button>
                          <button
                            className="border border-gray-700 text-gray-400 px-4 py-3 heist-font tracking-widest hover:border-white hover:text-white disabled:opacity-50 transition-colors"
                            onClick={() => setPendingDomainConfirm(null)}
                            disabled={!!actionInProgress}
                          >
                            CANCEL
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Waiting Queue */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end border-b border-gray-700 pb-2">
                  <h4 className="heist-font text-heist-teal text-2xl tracking-wider m-0">AWAITING ASSIGNMENT ({waitingQueue.length})</h4>
                  {gameState.isGameActive && (
                    <button
                      className="heist-mono text-xs border border-gray-600 px-2 py-1 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-wait"
                      onClick={() => safeAction('autoMatchPairs', autoMatchPairs)}
                      disabled={!!actionInProgress}
                    >
                      {actionInProgress === 'autoMatchPairs' ? 'ASSIGNING...' : 'FORCE ASSIGN'}
                    </button>
                  )}
                </div>
                {queueDiagnostics.length === 0 && <div className="heist-mono text-gray-500">Queue is empty.</div>}
                {queueDiagnostics.map(q => (
                  <div key={q.teamId} className="border border-gray-700 bg-black bg-opacity-60 p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="heist-font text-xl text-white">{q.teamName} <span className="text-heist-yellow text-sm ml-2">{q.tokens} TKN</span></span>
                      <span className={`heist-mono text-[10px] px-1 py-0.5 border ${q.hasAnyPossibleMatch ? 'border-heist-teal text-heist-teal' : 'border-gray-500 text-gray-400'}`}>
                        {q.hasAnyPossibleMatch ? 'SEARCHING' : 'BLOCKED'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 mt-2 border-t border-gray-800 pt-2">
                      {q.blockers.length === 0 ? (
                        <div className="heist-mono text-xs text-gray-500">Waiting for opponents...</div>
                      ) : (
                        q.blockers.slice(0, 3).map((b) => (
                          <div key={b.teamId} className="heist-mono text-[11px] flex justify-between">
                            <span className="text-gray-400">vs {b.teamName}</span>
                            <span className={b.canMatchNow ? 'text-heist-yellow' : 'text-heist-red'}>{b.canMatchNow ? 'Ready' : b.reasons[0]}</span>
                          </div>
                        ))
                      )}
                      {q.blockers.length > 3 && <div className="heist-mono text-[10px] text-gray-600 mt-1">+{q.blockers.length - 3} more blockers</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FIGHTING TAB (VAULTS) */}
        {tab === 'fighting' && (
          <div className="panel-container border-2 border-heist-red p-6 h-full flex flex-col bg-blueprint">
            <h3 className="heist-font text-heist-red text-3xl mb-6 tracking-wider">ACTIVE MISSIONS ({activeMatches.length})</h3>

            <div className="flex-1 overflow-y-auto pr-2 pb-10">
              {finaleActive && (
                <div className="border-2 border-orange-500 bg-black bg-opacity-80 p-4 mb-6">
                  <div className="flex items-center justify-between border-b border-orange-500/40 pb-3 mb-4">
                    <div className="heist-font text-orange-500 text-2xl tracking-widest">FINALE VAULT</div>
                    <div className="heist-mono text-[10px] uppercase tracking-widest text-gray-500">ROUND {finaleRound} OF 5</div>
                  </div>

                  {currentFinaleDomain ? (
                    <>
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <div className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">DOMAIN</div>
                          <div className="heist-font text-orange-500 text-3xl tracking-widest">{currentFinaleDomain}</div>
                        </div>
                        {roundStartedAt && (
                          <div className="flex items-center gap-2">
                            <Clock className="text-gray-400" size={16} />
                            <MatchTimer startTime={roundStartedAt} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          className="border-2 border-heist-red text-heist-red p-5 heist-font text-2xl hover:bg-heist-red hover:text-white transition-colors"
                          onClick={() => { if (window.confirm(`Declare ${gameState.finaleState?.teamAName} winner of this round?`)) declareFinaleRoundWinner('a'); }}
                        >
                          {gameState.finaleState?.teamAName} WINS
                        </button>
                        <button
                          className="border-2 border-heist-teal text-heist-teal p-5 heist-font text-2xl hover:bg-heist-teal hover:text-black transition-colors"
                          onClick={() => { if (window.confirm(`Declare ${gameState.finaleState?.teamBName} winner of this round?`)) declareFinaleRoundWinner('b'); }}
                        >
                          {gameState.finaleState?.teamBName} WINS
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="heist-mono text-gray-500 text-sm">
                      Awaiting domain selection in Finale Control.
                    </div>
                  )}
                </div>
              )}

              {activeMatches.length === 0 && <div className="heist-mono text-gray-500">No operations currently active.</div>}

              <div className="flex flex-col gap-6">
                {activeMatches.map(m => (
                  <div key={m.id} className="border-2 border-heist-red bg-black bg-opacity-80 p-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-1 bg-heist-red opacity-50"></div>

                    <div className="bg-[#111] p-4 flex flex-col gap-4 relative z-10">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                        <div className="flex gap-3 items-center">
                          <span className="heist-mono text-xs bg-heist-red text-white px-2 py-1 animate-pulse">LIVE</span>
                          <span className="heist-font text-xl tracking-widest text-white">{m.domain}</span>
                          {m.isWager && <span className="heist-mono text-xs border border-heist-teal text-heist-teal px-2 py-1">WAGER</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="text-gray-400" size={16} />
                          <MatchTimer startTime={m.startTime} />
                        </div>
                      </div>

                      {m.domain === 'TBD' && (
                        <div className="py-4 flex flex-col items-center">
                          <div className="heist-mono text-heist-yellow text-sm mb-4">ASSIGN DOMAIN TO BEGIN</div>
                          <DomainWheel
                            domains={domains}
                            resolveDomain={(selectedDomain) => handleSpinForMatch(m.id, selectedDomain)}
                            onSpin={() => { }}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-4">
                        <div className="flex flex-col items-center text-center gap-2">
                          <span className="heist-font text-3xl text-white break-all">{m.teamA.name}</span>
                          <span className="heist-font text-heist-yellow text-xl">{m.teamA.tokens} TKN</span>
                          <button
                            onClick={() => handleDeclareWinner(m, m.teamA)}
                            disabled={!!actionInProgress}
                            className={`mt-2 border border-heist-teal text-heist-teal hover:bg-heist-teal hover:text-black px-4 py-2 heist-font tracking-widest transition-colors w-full ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {actionInProgress === `declareWinner:${m.id}` ? 'DECLARING...' : 'DECLARE WINNER'}
                          </button>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                          <VenetianMask className="text-heist-red opacity-30" size={40} />
                          <span className="heist-font text-heist-red text-2xl mt-2">VS</span>
                        </div>

                        <div className="flex flex-col items-center text-center gap-2">
                          <span className="heist-font text-3xl text-white break-all">{m.teamB.name}</span>
                          <span className="heist-font text-heist-yellow text-xl">{m.teamB.tokens} TKN</span>
                          <button
                            onClick={() => handleDeclareWinner(m, m.teamB)}
                            disabled={!!actionInProgress}
                            className={`mt-2 border border-heist-teal text-heist-teal hover:bg-heist-teal hover:text-black px-4 py-2 heist-font tracking-widest transition-colors w-full ${actionInProgress ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {actionInProgress === `declareWinner:${m.id}` ? 'DECLARING...' : 'DECLARE WINNER'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {matchHistory.length > 0 && (
                <div className="mt-8">
                  <h4 className="heist-font text-gray-400 text-2xl tracking-wider border-b border-gray-800 pb-2 mb-4">OPERATION LOG</h4>
                  <div className="flex flex-col gap-2">
                    {matchHistory.slice(0, 5).map(h => (
                      <div key={h.id} className="border-l-4 border-gray-600 bg-black bg-opacity-50 p-2 flex justify-between items-center heist-mono text-sm">
                        <div>
                          <span className="text-white">{h.winner}</span> <span className="text-gray-600">def.</span> <span className="text-heist-red line-through">{h.loser}</span> <span className="text-gray-600">in</span> <span className="text-heist-teal">{h.domain}</span>
                        </div>
                        <span className="text-gray-500">{h.isWager ? '[WAGER]' : '±1'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RANKING TAB */}
        {tab === 'ranking' && (
          <div className="panel-container border-2 border-heist-yellow p-6 h-full flex flex-col bg-blueprint">
            <h3 className="heist-font text-heist-yellow text-3xl mb-6 tracking-wider">LIVE RANKINGS</h3>
            <div className="flex-1 overflow-y-auto pr-2 pb-10">
              <div className="flex flex-col gap-3">
                {sortedLeaderboard.map((t, idx) => {
                  const isEliminated = t.status === 'eliminated';
                  return (
                    <div key={t.id} className={`border border-gray-700 bg-black bg-opacity-80 p-4 flex items-center justify-between transition-colors ${isEliminated ? 'opacity-50 grayscale' : 'hover:border-heist-yellow'}`}>
                      <div className="flex items-center gap-6">
                        <span className={`heist-font text-4xl w-12 text-center ${isEliminated ? 'text-gray-800' : idx < 3 ? 'text-heist-yellow' : 'text-gray-600'}`}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-700 bg-black flex-shrink-0">
                          <img src={t.avatarSrc} alt={t.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span className={`heist-font text-3xl tracking-widest uppercase ${isEliminated ? 'text-heist-red line-through' : 'text-white'}`}>{t.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">Operator: {t.leader}</span>
                            {isEliminated && (
                              <span className="heist-mono text-[8px] uppercase tracking-widest text-heist-red border border-heist-red px-1.5 py-0.5 bg-red-950">
                                ELIMINATED
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`heist-font text-4xl tracking-widest ${isEliminated ? 'text-gray-800' : 'text-heist-yellow'}`}>{t.tokens}</span>
                        <span className="heist-mono text-[10px] text-gray-600 uppercase tracking-widest">TOKENS</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* FINALE TAB */}
        {tab === 'finale' && (
          <div className="panel-container border-2 border-orange-500 p-6 h-full flex flex-col bg-blueprint">
            <h3 className="heist-font text-orange-500 text-3xl mb-6 tracking-wider flex items-center gap-3">
              <Trophy size={28} /> FINALE CONTROL CENTER
            </h3>

            {!gameState.finaleState?.isFinaleActive ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <Skull className="text-gray-600" size={80} />
                <div className="heist-font text-gray-400 text-4xl tracking-widest text-center">NO FINALE ACTIVE</div>
                <div className="heist-mono text-gray-500 text-sm text-center max-w-lg leading-relaxed">
                  Use the <span className="text-orange-500 font-bold">END MATCH</span> button in the Operation Command panel above to lock all teams and start the finale between the top 2 leaderboard teams.
                </div>
                <button
                  className="border-2 border-orange-500 text-orange-500 px-8 py-3 heist-font text-2xl hover:bg-orange-500 hover:text-black transition-colors mt-4 flex items-center gap-3"
                  onClick={() => { if (window.confirm('END MATCH and start FINALE?')) endMatchAndStartFinale(); }}
                >
                  <Skull size={24} /> INITIATE FINALE
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 pb-10">
                {/* Finale Status Header */}
                <div className="border-2 border-orange-500 bg-black bg-opacity-80 p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="heist-font text-orange-500 text-2xl tracking-widest">LIVE FINALE</div>
                    <div className="heist-mono text-xs border border-orange-500 text-orange-500 px-2 py-1 animate-pulse">
                      ROUND {(gameState.finaleState.currentRound || 0) + 1} OF 5
                    </div>
                  </div>

                  {/* Matchup Display */}
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center py-6">
                    <div className="flex flex-col items-center text-center gap-2">
                      <span className="heist-font text-3xl text-white">{gameState.finaleState.teamAName}</span>
                      <span className="heist-font text-5xl text-heist-red">{gameState.finaleState.winsA || 0}</span>
                      <span className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">WINS</span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Swords className="text-orange-500" size={40} />
                      <span className="heist-font text-orange-500 text-2xl mt-2">VS</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-2">
                      <span className="heist-font text-3xl text-white">{gameState.finaleState.teamBName}</span>
                      <span className="heist-font text-5xl text-heist-teal">{gameState.finaleState.winsB || 0}</span>
                      <span className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">WINS</span>
                    </div>
                  </div>

                  {/* Round Tracker */}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    {Array.from({ length: 5 }, (_, i) => {
                      const result = (gameState.finaleState.finaleResults || [])[i];
                      return (
                        <div key={i} className={`w-8 h-8 border-2 flex items-center justify-center heist-font text-lg ${result === 'a' ? 'border-heist-red bg-heist-red bg-opacity-20 text-heist-red' :
                          result === 'b' ? 'border-heist-teal bg-heist-teal bg-opacity-20 text-heist-teal' :
                            i === (gameState.finaleState.currentRound || 0) ? 'border-orange-500 text-orange-500 animate-pulse' :
                              'border-gray-700 text-gray-700'
                          }`}>
                          {result === 'a' ? 'A' : result === 'b' ? 'B' : (i + 1)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Domain Selector — Only show if no winner yet and round < 5 */}
                {!gameState.finaleState.finaleWinner && (gameState.finaleState.currentRound || 0) < 5 && (
                  <div className="border border-gray-700 bg-black bg-opacity-80 p-6 mb-6">
                    <h4 className="heist-font text-heist-yellow text-2xl mb-4 tracking-wider">
                      SELECT DOMAIN — ROUND {finaleRound}
                    </h4>
                    <div className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest mb-4">
                      USED DOMAINS: {finaleDomains.length > 0 ? finaleDomains.join(', ') : 'NONE'}
                    </div>
                    {currentFinaleDomain ? (
                      <div className="text-center py-4">
                        <div className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">CURRENT DOMAIN</div>
                        <div className="heist-font text-orange-500 text-4xl tracking-widest">{currentFinaleDomain}</div>
                        {roundStartedAt && (
                          <div className="flex items-center justify-center gap-3 mt-4">
                            <span className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">ROUND TIMER</span>
                            <MatchTimer startTime={roundStartedAt} />
                          </div>
                        )}
                        <div className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest mt-4">
                          DECLARE WINNER IN VAULTS
                        </div>
                      </div>
                    ) : (
                      <>
                        {availableFinaleDomains.length === 0 ? (
                          <div className="heist-mono text-gray-500 text-sm text-center py-6">
                            All domains have been used. Update domains in Schematics if you need more options.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {availableFinaleDomains.map(d => (
                              <button
                                key={d}
                                className={`border p-4 heist-font text-xl tracking-wider transition-colors ${selectedFinaleDomain === d
                                  ? 'border-orange-500 bg-orange-500 bg-opacity-20 text-orange-500'
                                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                                  }`}
                                onClick={() => setSelectedFinaleDomain(d)}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedFinaleDomain && (
                          <button
                            className="mt-4 w-full bg-orange-500 text-black py-3 heist-font text-xl tracking-wider hover:bg-orange-400 transition-colors"
                            onClick={() => { setFinaleDomain(selectedFinaleDomain); setSelectedFinaleDomain(''); }}
                          >
                            LOCK DOMAIN: {selectedFinaleDomain}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Winner Declaration — Only show if domain is set */}
                {!gameState.finaleState.finaleWinner && gameState.finaleState.currentDomain && (
                  <div className="border-2 border-heist-red bg-black bg-opacity-80 p-6 mb-6">
                    <h4 className="heist-font text-heist-red text-2xl mb-4 tracking-wider">DECLARE ROUND WINNER</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        className="border-2 border-heist-red text-heist-red p-6 heist-font text-2xl hover:bg-heist-red hover:text-white transition-colors flex flex-col items-center gap-2"
                        onClick={() => { if (window.confirm(`Declare ${gameState.finaleState.teamAName} winner of this round?`)) declareFinaleRoundWinner('a'); }}
                      >
                        <Crown size={32} />
                        {gameState.finaleState.teamAName} WINS
                      </button>
                      <button
                        className="border-2 border-heist-teal text-heist-teal p-6 heist-font text-2xl hover:bg-heist-teal hover:text-black transition-colors flex flex-col items-center gap-2"
                        onClick={() => { if (window.confirm(`Declare ${gameState.finaleState.teamBName} winner of this round?`)) declareFinaleRoundWinner('b'); }}
                      >
                        <Crown size={32} />
                        {gameState.finaleState.teamBName} WINS
                      </button>
                    </div>
                  </div>
                )}

                {/* Victory State */}
                {gameState.finaleState.finaleWinner && (
                  <div className="border-2 border-heist-yellow bg-black bg-opacity-80 p-8 text-center">
                    <Crown className="text-heist-yellow mx-auto mb-4" size={64} />
                    <div className="heist-font text-heist-yellow text-5xl tracking-widest mb-2">CHAMPION</div>
                    <div className="heist-font text-white text-4xl tracking-widest mb-4">
                      {gameState.finaleState.finaleWinner === 'a' ? gameState.finaleState.teamAName : gameState.finaleState.teamBName}
                    </div>
                    <div className="heist-font text-3xl mb-6">
                      <span className="text-heist-red">{gameState.finaleState.winsA}</span>
                      <span className="text-gray-600 mx-2">—</span>
                      <span className="text-heist-teal">{gameState.finaleState.winsB}</span>
                    </div>
                    <button
                      className="border border-gray-600 text-gray-400 px-6 py-2 heist-font text-lg hover:bg-gray-800 transition-colors"
                      onClick={() => { if (window.confirm('End finale and unlock all teams?')) endFinale(); }}
                    >
                      END FINALE & UNLOCK TEAMS
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOGS TAB */}
        {tab === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Intel Feed */}
            <div className="panel-container border-2 border-heist-teal p-6 flex flex-col bg-blueprint">
              <div className="flex justify-between items-center mb-6">
                <h3 className="heist-font text-heist-teal text-3xl tracking-wider m-0">INTEL FEED</h3>
                <div className="flex gap-2">
                  <button onClick={() => setLogFilter('all')} className={`heist-mono text-[10px] px-2 py-1 border ${logFilter === 'all' ? 'bg-heist-teal text-black border-heist-teal' : 'text-gray-500 border-gray-700'}`}>ALL</button>
                  <button onClick={() => setLogFilter('matches')} className={`heist-mono text-[10px] px-2 py-1 border ${logFilter === 'matches' ? 'bg-heist-teal text-black border-heist-teal' : 'text-gray-500 border-gray-700'}`}>MATCHES</button>
                  <button onClick={() => setLogFilter('admin')} className={`heist-mono text-[10px] px-2 py-1 border ${logFilter === 'admin' ? 'bg-heist-teal text-black border-heist-teal' : 'text-gray-500 border-gray-700'}`}>ADMIN</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 custom-scrollbar">
                {[...filteredNotifications].reverse().map((n, i) => (
                  <div key={i} className="border-l-2 border-heist-teal bg-black bg-opacity-60 p-3 hover:bg-opacity-80 transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span className="heist-mono text-[10px] text-gray-500 uppercase">{n.time}</span>
                    </div>
                    <p className="heist-mono text-xs text-gray-300 leading-relaxed m-0 uppercase tracking-widest">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Telemetry Logs */}
            <div className="panel-container border-2 border-heist-red p-6 flex flex-col bg-blueprint">
              <h3 className="heist-font text-heist-red text-3xl mb-6 tracking-wider">TELEMETRY LOGS</h3>
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 custom-scrollbar">
                {telemetryLogs.map((entry, i) => (
                  <div key={`${entry.time || 'telemetry'}-${i}`} className="border-l-2 border-heist-red bg-black bg-opacity-60 p-3 hover:bg-opacity-80 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="heist-mono text-[10px] text-red-500 uppercase font-bold tracking-widest">EVENT</span>
                      <span className="heist-mono text-[10px] text-gray-500 uppercase">{entry.time || entry.timestamp || entry.created_at}</span>
                    </div>
                    <div className="heist-mono text-xs tracking-widest uppercase flex items-center gap-2">
                      <span className="text-white">{entry.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            <div className="panel-container border-2 border-[#444] p-6 relative overflow-hidden">
              <h3 className="heist-font text-white text-3xl mb-6 tracking-wider">DOMAIN SCHEMATICS</h3>
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex gap-2">
                  <input
                    className="input-heist"
                    value={domainInput}
                    onChange={e => setDomainInput(e.target.value)}
                    placeholder="NEW DOMAIN"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (domainInput.trim() && !domains.includes(domainInput.trim())) { updateDomains([...domains, domainInput.trim()]); setDomainInput(''); } } }}
                  />
                  <button className="bg-gray-700 text-white px-4 hover:bg-white hover:text-black transition-colors" onClick={() => { if (domainInput.trim() && !domains.includes(domainInput.trim())) { updateDomains([...domains, domainInput.trim()]); setDomainInput(''); } }}>
                    <Plus size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-2 mt-4 max-h-[300px] overflow-y-auto pr-2">
                  {domains.map((d, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-black border border-gray-700">
                      <span className="heist-mono text-white text-sm">{d}</span>
                      <button className="text-gray-500 hover:text-heist-red transition-colors" onClick={() => updateDomains(domains.filter((_, idx) => idx !== i))}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel-container border-2 border-heist-yellow p-6 relative overflow-hidden">
              <h3 className="heist-font text-heist-yellow text-3xl mb-6 tracking-wider">TIMEOUT PARAMETERS</h3>
              <div className="flex flex-col gap-4 relative z-10">
                <div className="heist-mono text-sm text-gray-300 bg-black bg-opacity-80 p-4 border-l-2 border-heist-yellow">
                  Override default 0-token elimination timeout.<br /><br />
                  CURRENT: <span className="text-heist-yellow">{gameState.timeoutDurationOverride ? (gameState.timeoutDurationOverride / 60000) + ' MIN' : 'DYNAMIC'}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <input className="input-heist" type="number" value={timeoutInput} onChange={e => setTimeoutInput(e.target.value)} placeholder="MINUTES" />
                  <button className="bg-heist-yellow text-black px-4 heist-font text-xl tracking-wider hover:bg-white transition-colors" onClick={() => { if (timeoutInput) { updateTimeout(Number(timeoutInput)); setTimeoutInput(''); } }}>
                    SET
                  </button>
                </div>
                {gameState.timeoutDurationOverride && (
                  <button className="border border-gray-600 text-gray-400 py-2 heist-font text-xl tracking-wider hover:bg-gray-800 transition-colors mt-2" onClick={() => updateTimeout(null)}>
                    RESTORE DEFAULT
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto relative z-10">
        <div className="panel-container border-t-2 border-gray-500 p-3 flex flex-col items-center justify-center gap-1">
          <span className="heist-mono text-[10px] text-gray-400 tracking-widest uppercase">TOTAL CREW</span>
          <div className="flex items-center gap-2">
            <Users className="text-gray-400" size={24} />
            <span className="heist-font text-3xl md:text-4xl text-gray-300">{teams.length}</span>
          </div>
        </div>
        <div className="panel-container border-t-2 border-heist-teal p-3 flex flex-col items-center justify-center gap-1">
          <span className="heist-mono text-[10px] text-gray-400 tracking-widest uppercase">PLANS READY</span>
          <div className="flex items-center gap-2">
            <ScrollText className="text-heist-teal" size={24} />
            <span className="heist-font text-3xl md:text-4xl text-heist-teal">{queuePairs.length}</span>
          </div>
        </div>
        <div className="panel-container border-t-2 border-heist-red p-3 flex flex-col items-center justify-center gap-1">
          <span className="heist-mono text-[10px] text-gray-400 tracking-widest uppercase">ACTIVE MISSIONS</span>
          <div className="flex items-center gap-2">
            <Map className="text-heist-red" size={24} />
            <span className="heist-font text-3xl md:text-4xl text-heist-red">{activeMatches.length}</span>
          </div>
        </div>
        <div className="panel-container border-t-2 border-heist-yellow p-3 flex flex-col items-center justify-center gap-1">
          <span className="heist-mono text-[10px] text-gray-400 tracking-widest uppercase">PHASE</span>
          <div className="flex items-center gap-2">
            <Crown className="text-heist-yellow" size={24} />
            <span className="heist-font text-3xl md:text-4xl text-heist-yellow">{gameState.phase === 'phase2' ? '2' : '1'}</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="panel-container border-2 border-heist-red p-6 max-w-md w-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-heist-red to-transparent"></div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                confirmConfig.type === 'danger' ? 'bg-heist-red/20 text-heist-red' :
                confirmConfig.type === 'warning' ? 'bg-orange-500/20 text-orange-500' :
                confirmConfig.type === 'success' ? 'bg-heist-yellow/20 text-heist-yellow' :
                'bg-heist-teal/20 text-heist-teal'
              }`}>
                <AlertTriangle size={28} />
              </div>
              <h3 className="heist-font text-3xl tracking-widest text-white m-0 uppercase">{confirmConfig.title}</h3>
            </div>
            
            <p className="heist-mono text-gray-300 text-sm mb-4 leading-relaxed">
              {confirmConfig.message}
            </p>

            {confirmConfig.verificationText && (
              <div className="mb-6">
                <label className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">
                  Safety Verification Required: Type <span className="text-heist-red font-bold select-all cursor-copy">{confirmConfig.verificationText}</span> to proceed.
                </label>
                <input
                  type="text"
                  className="input-heist w-full text-center tracking-widest font-bold"
                  placeholder="ENTER VERIFICATION KEY"
                  autoFocus
                  onChange={(e) => {
                    if (e.target.value === confirmConfig.verificationText) {
                      setConfirmConfig(prev => ({ ...prev, _verified: true }));
                    } else {
                      setConfirmConfig(prev => ({ ...prev, _verified: false }));
                    }
                  }}
                />
              </div>
            )}
            
            <div className="flex gap-4">
              <button 
                className="flex-1 py-3 heist-font text-xl tracking-widest bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                onClick={() => setConfirmConfig(null)}
              >
                CANCEL
              </button>
              <button 
                className={`flex-1 py-3 heist-font text-xl tracking-widest text-black transition-colors ${
                  confirmConfig.type === 'danger' ? 'bg-heist-red hover:bg-red-400' :
                  confirmConfig.type === 'warning' ? 'bg-orange-500 hover:bg-orange-400' :
                  confirmConfig.type === 'success' ? 'bg-heist-yellow hover:bg-yellow-400' :
                  'bg-heist-teal hover:bg-teal-400'
                } ${(confirmConfig.verificationText && !confirmConfig._verified) ? 'opacity-30 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (confirmConfig.verificationText && !confirmConfig._verified) return;
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                disabled={confirmConfig.verificationText && !confirmConfig._verified}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics / Vercel Optimization Footer */}
      <div className="mt-8 border-t border-white/5 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasSupabaseConfig ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
            <span className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">
              SUPABASE: {hasSupabaseConfig ? 'CONFIGURED' : 'MISSING CONFIG'}
            </span>
          </div>
          {diagResult && (
            <div className="heist-mono text-[10px] text-heist-teal animate-pulse">
              {diagResult}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={runDiagnostics}
            disabled={!!actionInProgress}
            className="heist-mono text-[10px] text-gray-500 hover:text-white transition-colors border border-white/10 px-2 py-1 flex items-center gap-2"
          >
            <Activity size={12} />
            RUN DIAGNOSTICS
          </button>
          <span className="heist-mono text-[10px] text-gray-600">
            ENV: {import.meta.env.MODE.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminScreen;
