import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '../hooks/useGameState';
import {
  VenetianMask, Banknote, Lock, Bomb, Users, Search, Flame, Settings,
  Plus, X, Fingerprint, Wallet, Map, ScrollText, Crown, Zap, AlertTriangle, Clock
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
    enrollAllEligible, autoMatchPairs
  } = useGameState();

  // Matchmaking is now handled globally by useGameSocketBridge (3s interval)
  // No need to trigger autoMatchPairs from AdminScreen anymore


  const [tab, setTab] = useState('teams');
  const [selectedProfile, setSelectedProfile] = useState(() => PROFILE_AVATARS[0]?.name || '');
  const [customTeamName, setCustomTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberNames, setMemberNames] = useState([]);
  const [leader, setLeader] = useState('');

  const [logFilter, setLogFilter] = useState('all'); // 'all', 'matches', 'admin'

  const [domainInput, setDomainInput] = useState('');
  const [timeoutInput, setTimeoutInput] = useState('');

  const domains = gameState.domains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
  const assignedProfiles = useMemo(() => new Set((teams || []).map((team) => team.name)), [teams]);

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

  const handleCreateTeam = (e) => {
    e.preventDefault();
    const isCustom = selectedProfile === CUSTOM_PROFILE_VALUE;
    const teamName = isCustom ? customTeamName.trim() : selectedProfile;
    const profileAlreadyAssigned = !isCustom && assignedProfiles.has(selectedProfile);

    if (!teamName || !teamPassword || memberNames.length < 1 || !leader || profileAlreadyAssigned) return;

    createTeam({ name: teamName, memberNames, leader, password: teamPassword });
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
    () => buildQueueDiagnostics({ gameState, teams, matchmakingQueue, matchConstraints }),
    [gameState, teams, matchmakingQueue, matchConstraints]
  );

  const tabs = [
    { id: 'teams', label: 'TEAMS', icon: <Users size={20} /> },
    { id: 'ranking', label: 'RANKING', icon: <Crown size={20} /> },
    { id: 'queue', label: 'PLANS', icon: <Search size={20} /> },
    { id: 'fighting', label: 'VAULTS', icon: <Flame size={20} /> },
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
              {gameState.phase === 'phase2' ? 'PHASE 2 — WAGER' : 'PHASE 1 — INFILTRATION'}
            </span>
            <Banknote className="text-heist-teal" size={20} />
          </div>
          <button
            className="border border-heist-red text-heist-red px-4 py-2 heist-font text-lg md:text-xl tracking-widest hover:bg-heist-red hover:text-black transition-colors flex-1 md:flex-none"
            onClick={() => { if (window.confirm('Abort mission? This deletes ALL data.')) resetGame(); }}
          >
            ABORT MISSION
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
              className={`px-6 py-2 heist-font text-xl tracking-wider min-w-[120px] transition-colors ${gameState.isPaused || !gameState.isGameActive ? 'bg-heist-red text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              onClick={stopGame}
            >
              ON HOLD
            </button>
            <button className="px-6 py-2 bg-heist-teal text-black heist-font text-xl tracking-wider flex items-center gap-2 min-w-[120px]">
              PHASE {gameState.phase === 'phase2' ? '2' : '1'} <Banknote size={20} />
            </button>
            <button
              className={`px-6 py-2 heist-font text-xl tracking-wider flex items-center gap-2 min-w-[160px] transition-colors ${gameState.isGameActive && !gameState.isPaused ? 'bg-heist-yellow text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              onClick={startGame}
            >
              EXECUTE PLAN <Lock size={20} />
            </button>
          </div>
          <div className="flex gap-2 relative mt-2 xl:mt-0">
            <button
              className="border border-heist-red text-heist-red px-6 py-1 heist-font text-lg hover:bg-heist-red hover:text-black transition-colors"
              onClick={() => { if (window.confirm('Reset?')) resetGame(); }}
            >
              RESET PARAMETERS
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
          <div className="flex flex-col">
            <div className="heist-font text-2xl tracking-wider text-white">
              {gameState.phase === 'phase2' ? 'PHASE 2 — WAGER MODE' : 'PHASE 1 — INFILTRATION'}
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
          className="bg-heist-teal text-black px-6 py-2 heist-font text-xl flex items-center justify-center gap-2 hover:bg-white transition-colors w-full md:w-auto flex-shrink-0"
          onClick={togglePhase}
        >
          {gameState.phase === 'phase2' ? 'REVERT PHASE' : 'INITIATE PHASE 2'} <Bomb size={20} />
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
                            <img src={profile.src} alt={profile.label} className="w-full h-full object-cover" />
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
                <button type="submit" className="mt-4 bg-[#bbb] text-black py-3 heist-font text-xl tracking-wider flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-50" disabled={(selectedProfile === CUSTOM_PROFILE_VALUE ? !customTeamName.trim() : !selectedProfile || assignedProfiles.has(selectedProfile)) || !teamPassword || memberNames.length < 1 || !leader}>
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
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700 bg-black flex-shrink-0">
                          <img src={t.avatarSrc} alt={getProfileLabel(t.name)} className="w-full h-full object-cover" />
                        </div>
                        <span className={`heist-font text-2xl tracking-wider ${t.status === 'eliminated' ? 'text-heist-red line-through' : t.status === 'timeout' ? 'text-gray-500' : 'text-white'}`}>{t.name}</span>
                        <span className={`heist-mono text-[10px] px-1 py-0.5 border ${t.status === 'eliminated' ? 'border-heist-red text-heist-red' : t.status === 'idle' ? 'border-heist-yellow text-heist-yellow' : t.status === 'fighting' ? 'border-heist-red bg-heist-red text-white' : 'border-gray-500 text-gray-400'}`}>
                          {t.status.toUpperCase()}
                        </span>
                        {t.status === 'timeout' && t.timeoutUntil && <TimeoutDisplay timeoutUntil={t.timeoutUntil} />}
                      </div>
                      <span className="heist-mono text-xs text-gray-400 mt-1">L: {t.leader} | {t.memberNames?.filter(m => m !== t.leader).join(', ')}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t border-gray-800 sm:border-0 pt-3 sm:pt-0">
                      <span className="heist-font text-heist-yellow text-2xl">{t.tokens} TKN</span>
                      <div className="flex items-center gap-1 bg-[#111] p-1 border border-gray-800">
                        <button onClick={() => updateTokens(t.id, 1, 'Admin')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-heist-yellow hover:bg-gray-800 transition-colors">+</button>
                        <button onClick={() => updateTokens(t.id, -1, 'Admin')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-heist-red hover:bg-gray-800 transition-colors">-</button>
                        <button onClick={() => deleteTeam(t.id)} className="w-8 h-8 flex items-center justify-center text-heist-red hover:bg-heist-red hover:text-white transition-colors ml-1"><X size={16} /></button>
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
                {queuePairs.map((pair, i) => (
                  <div key={i} className="border border-heist-yellow bg-black bg-opacity-80 p-4">
                    <div className="heist-font text-2xl text-center mb-4 flex items-center justify-center gap-4">
                      <span className="text-white">{pair.teamAName}</span>
                      <span className="text-heist-red">VS</span>
                      <span className="text-white">{pair.teamBName}</span>
                    </div>
                    <div className="flex justify-center border-t border-gray-800 pt-4">
                      <DomainWheel domains={domains} onSpin={(domain) => createMatch(pair.teamAId, pair.teamBId, domain)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Waiting Queue */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end border-b border-gray-700 pb-2">
                  <h4 className="heist-font text-heist-teal text-2xl tracking-wider m-0">AWAITING ASSIGNMENT ({waitingQueue.length})</h4>
                  {gameState.isGameActive && (
                    <button className="heist-mono text-xs border border-gray-600 px-2 py-1 hover:bg-gray-800" onClick={enrollAllEligible}>
                      FORCE RE-ENROLL
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
                          <button onClick={() => declareWinner(m.id, m.teamA.id)} className="mt-2 border border-heist-teal text-heist-teal hover:bg-heist-teal hover:text-black px-4 py-2 heist-font tracking-widest transition-colors w-full">
                            DECLARE WINNER
                          </button>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                          <VenetianMask className="text-heist-red opacity-30" size={40} />
                          <span className="heist-font text-heist-red text-2xl mt-2">VS</span>
                        </div>

                        <div className="flex flex-col items-center text-center gap-2">
                          <span className="heist-font text-3xl text-white break-all">{m.teamB.name}</span>
                          <span className="heist-font text-heist-yellow text-xl">{m.teamB.tokens} TKN</span>
                          <button onClick={() => declareWinner(m.id, m.teamB.id)} className="mt-2 border border-heist-teal text-heist-teal hover:bg-heist-teal hover:text-black px-4 py-2 heist-font tracking-widest transition-colors w-full">
                            DECLARE WINNER
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
                {[...matchHistory].reverse().map((h, i) => (
                  <div key={h.id || i} className="border-l-2 border-heist-red bg-black bg-opacity-60 p-3 hover:bg-opacity-80 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="heist-mono text-[10px] text-red-500 uppercase font-bold tracking-widest">{h.domain}</span>
                      <span className="heist-mono text-[10px] text-gray-500 uppercase">{h.timestamp}</span>
                    </div>
                    <div className="heist-mono text-xs tracking-widest uppercase flex items-center gap-2">
                      <span className="text-white">{h.winner}</span>
                      <span className="text-heist-red">// NEUTRALIZED //</span>
                      <span className="text-gray-400">{h.loser}</span>
                    </div>
                    {h.isWager && <div className="mt-2 heist-mono text-[8px] text-heist-teal border border-heist-teal w-fit px-1">WAGER MATCH</div>}
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
            <span className="heist-font text-3xl md:text-4xl text-heist-teal">{waitingQueue.length}</span>
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
    </div>
  );
};

export default AdminScreen;
