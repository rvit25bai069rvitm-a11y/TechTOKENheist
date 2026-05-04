import React, { useState, useEffect, useMemo } from 'react';
import { useGameState } from '../hooks/useGameState';
import { Users, Swords, Flame, Settings, Plus, X, Trophy, Clock, Play, Pause, Zap, Search, RotateCcw } from 'lucide-react';
import DomainWheel from '../components/DomainWheel';
import { buildQueueDiagnostics } from '../utils/matchmaking';

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
  return <div className="stopwatch">{display}</div>;
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
  return <span className="badge badge-warning">{remaining}</span>;
};

const AdminScreen = () => {
  const {
    gameState, teams, matchmakingQueue, activeMatches, matchHistory,
    sortedLeaderboard, gameTimer, queuePairs, matchConstraints,
    startGame, stopGame, resetGame, togglePhase, createTeam, editTeam, deleteTeam,
    updateTokens, createMatch, declareWinner, spinDomain, updateDomains, setTimeoutDuration
  } = useGameState();

  const [editingTeam, setEditingTeam] = useState(null);
  const [tab, setTab] = useState('teams');
  const [teamName, setTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberNames, setMemberNames] = useState([]);
  const [leader, setLeader] = useState('');
  const [spinResults, setSpinResults] = useState({});

  const [domainInput, setDomainInput] = useState('');
  const [timeoutInput, setTimeoutInput] = useState('');

  const domains = gameState.domains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];

  const addMember = () => {
    if (memberInput.trim() && memberNames.length < 4) {
      setMemberNames([...memberNames, memberInput.trim()]);
      setMemberInput('');
    }
  };
  const removeMember = (idx) => {
    const updated = memberNames.filter((_, i) => i !== idx);
    setMemberNames(updated);
    if (leader === memberNames[idx]) setLeader('');
  };
  const handleCreateTeam = (e) => {
    e.preventDefault();
    if (!teamName || memberNames.length < 2 || !leader || !teamPassword) return;
    createTeam({ name: teamName, memberNames, leader, password: teamPassword });
    setTeamName(''); setTeamPassword(''); setMemberNames([]); setMemberInput(''); setLeader('');
  };

  const handleSpinForMatch = async (matchId, preferredDomain) => {
    const result = await spinDomain(matchId, preferredDomain);
    if (result?.domain) setSpinResults(prev => ({ ...prev, [matchId]: result.domain }));
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

  const fightingTeams = useMemo(
    () => teams.filter((t) => t.status === 'fighting'),
    [teams]
  );

  const tabs = [
    { id: 'teams', label: 'Teams', icon: <Users size={16} />, count: teams.length },
    { id: 'queue', label: 'Queue', icon: <Search size={16} />, count: (matchmakingQueue || []).length },
    { id: 'fighting', label: 'Matches', icon: <Flame size={16} />, count: activeMatches.length },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} />, count: 0 },
  ];

  return (
    <div className="flex-col gap-4">
      {/* Header */}
      <div className="card flex items-center justify-between" style={{ padding: '1rem 1.5rem', border: '1px solid var(--accent-danger)' }}>
        <div className="flex items-center gap-3">
          <Settings className="text-danger" size={24} />
          <h2 className="font-heading" style={{ margin: 0 }}>ADMIN CONTROL</h2>
        </div>
        <div className="flex items-center gap-4">
          {(gameState.isGameActive || gameState.isPaused) && <div className="game-timer flex items-center gap-2 font-mono"><Clock size={14} /> {gameTimer}</div>}
          <span className={`badge ${gameState.isGameActive ? 'badge-survival' : gameState.isPaused ? 'badge-warning' : 'badge-danger'}`}>
            {gameState.isGameActive ? 'GAME ACTIVE' : gameState.isPaused ? 'GAME PAUSED' : 'GAME STOPPED'}
          </span>
          <span className={`badge ${gameState.phase === 'phase2' ? 'badge-magenta' : 'badge-cyan'}`}>
            {gameState.phase === 'phase2' ? 'PHASE 2' : 'PHASE 1'}
          </span>
          {gameState.isGameActive ? (
            <button className="btn btn-warning" onClick={stopGame}><Pause size={16} /> Pause</button>
          ) : (
            <button className="btn btn-primary" onClick={startGame}><Play size={16} /> {gameState.isPaused ? 'Resume' : 'Start Game'}</button>
          )}
          <button className="btn btn-danger" onClick={() => { if(window.confirm('Hard reset tournament?')) resetGame(); }}><X size={16} /> Reset</button>
        </div>
      </div>

      {/* Phase Toggle */}
      <div className="card flex items-center justify-between" style={{ padding: '0.75rem 1.5rem', border: `1px solid ${gameState.phase === 'phase2' ? 'var(--accent-magenta)' : 'var(--border-subtle)'}`, background: gameState.phase === 'phase2' ? 'rgba(255, 95, 143, 0.08)' : undefined }}>
        <div className="flex items-center gap-3">
          <Zap size={20} className={gameState.phase === 'phase2' ? 'text-magenta' : 'text-muted'} />
          <div>
            <div className="font-heading" style={{ fontSize: '1.1rem' }}>{gameState.phase === 'phase2' ? 'PHASE 2 — WAGER MODE' : 'PHASE 1 — STANDARD'}</div>
            <div className="text-muted font-mono" style={{ fontSize: '0.7rem' }}>
              {gameState.phase === 'phase2' ? 'No limits · Winner takes all · 0 tokens = eliminated' : 'Queue match ±3 range · +1/-1 stakes · Timeout on 0 tokens'}
            </div>
          </div>
        </div>
        <button className={`btn ${gameState.phase === 'phase2' ? 'btn-danger' : 'btn-ghost'}`} onClick={togglePhase} style={{ minWidth: '140px', justifyContent: 'center' }}>
          {gameState.phase === 'phase2' ? '🔥 PHASE 2 ACTIVE' : 'SWITCH TO PHASE 2'}
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {t.count > 0 && <span className="tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* TAB: TEAMS */}
      {tab === 'teams' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 className="font-heading text-survival" style={{ marginBottom: '1.25rem', fontSize: '1.5rem' }}>CREATE TEAM</h3>
            <form onSubmit={handleCreateTeam} className="flex-col gap-3">
              <div className="flex-col gap-1">
                <label className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Team Name</label>
                <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. CodeBreakers" required />
              </div>
              <div className="flex-col gap-1">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Password</label>
                <input className="input" value={teamPassword} onChange={e => setTeamPassword(e.target.value)} placeholder="Login password" required />
              </div>
              <div className="flex-col gap-1">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Members ({memberNames.length}/4)</label>
                <div className="flex gap-2">
                  <input className="input" value={memberInput} onChange={e => setMemberInput(e.target.value)} placeholder="Member name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }} />
                  <button type="button" className="btn btn-ghost" onClick={addMember} disabled={memberNames.length >= 4}><Plus size={16} /></button>
                </div>
                <div className="flex flex-wrap gap-2" style={{ marginTop: '0.5rem' }}>
                  {memberNames.map((m, i) => (
                    <div key={i} className="flex items-center gap-1" style={{ padding: '0.3rem 0.6rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.85rem' }}>
                      {m} <button type="button" onClick={() => removeMember(i)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
              {memberNames.length >= 2 && (
                <div className="flex-col gap-1">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Select Leader</label>
                  <select className="input" value={leader} onChange={e => setLeader(e.target.value)} required>
                    <option value="">Choose leader...</option>
                    {memberNames.map((m, i) => <option key={i} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="btn btn-primary" disabled={!teamName || memberNames.length < 2 || !leader || !teamPassword}><Plus size={16} /> Create Team</button>
            </form>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 className="font-heading" style={{ marginBottom: '1.25rem', fontSize: '1.5rem' }}>ALL TEAMS ({teams.length})</h3>
            <div className="flex-col gap-2" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {teams.length === 0 && <p className="text-muted font-mono">No teams found.</p>}
              {teams.map(t => (
                editingTeam?.id === t.id ? (
                  <div key={t.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--accent-survival)' }}>
                    <div className="flex-col gap-2">
                      <input className="input" value={editingTeam.name} onChange={e => setEditingTeam({...editingTeam, name: e.target.value})} />
                      <input className="input" value={editingTeam.password} onChange={e => setEditingTeam({...editingTeam, password: e.target.value})} />
                      <input className="input" type="number" value={editingTeam.tokens} onChange={e => setEditingTeam({...editingTeam, tokens: Number(e.target.value)})} />
                      <div className="flex gap-2 mt-2">
                        <button className="btn btn-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => { editTeam(editingTeam); setEditingTeam(null); }}>Save</button>
                        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingTeam(null)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-4">
                        <span className="font-heading" style={{ fontSize: '18px', color: t.status === 'eliminated' ? 'var(--accent-danger)' : t.status === 'timeout' ? 'var(--accent-warning)' : 'inherit' }}>{t.name}</span>
                        <span className={`badge badge-${t.status === 'eliminated' ? 'danger' : t.status === 'idle' ? 'survival' : t.status === 'fighting' ? 'danger' : t.status === 'timeout' ? 'warning' : t.status === 'queued' || t.status === 'matched' ? 'cyan' : 'warning'}`}>
                          {t.status.toUpperCase()}
                        </span>
                        {t.status === 'timeout' && t.timeoutUntil && <TimeoutDisplay timeoutUntil={t.timeoutUntil} />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-survival">{t.tokens} TKN</span>
                        <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={() => setEditingTeam(t)}>Edit</button>
                        <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={() => updateTokens(t.id, 1, 'Admin +1')}>+1</button>
                        <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={() => updateTokens(t.id, -1, 'Admin -1')}>-1</button>
                        <button className="btn btn-danger" style={{ padding: '0.2rem 0.4rem' }} onClick={() => deleteTeam(t.id)}><X size={12} /></button>
                      </div>
                    </div>
                    <div className="text-muted font-mono" style={{ fontSize: '0.8rem' }}>Leader: <span className="text-survival">{t.leader}</span> · {t.memberNames?.join(', ')}</div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: QUEUE */}
      {tab === 'queue' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="font-heading" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>MATCHMAKING QUEUE</h3>

          {/* Matched Pairs */}
          {queuePairs.length > 0 && (
            <>
              <h4 className="font-heading text-survival" style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>MATCHED PAIRS — Ready for Match</h4>
              {queuePairs.map((pair, i) => (
                <div key={i} style={{ padding: '1.5rem', background: 'rgba(105, 255, 117, 0.05)', border: '1px solid rgba(105, 255, 117, 0.2)', marginBottom: '1rem' }}>
                  <div className="font-heading" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                    {pair.teamAName} <span className="text-danger">VS</span> {pair.teamBName}
                  </div>
                  <div className="flex items-center gap-4">
                    <DomainWheel domains={domains} onSpin={(domain) => {
                      createMatch(pair.teamAId, pair.teamBId, domain);
                    }} />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Waiting in Queue */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(255,51,102,0.06)', border: '1px solid rgba(255,51,102,0.2)', borderRadius: '8px' }}>
              <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>LIVE TEAMS FIGHTING</div>
              <div className="font-heading text-danger" style={{ fontSize: '1.4rem' }}>{fightingTeams.length}</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(121, 255, 214, 0.06)', border: '1px solid rgba(121,255,214,0.2)', borderRadius: '8px' }}>
              <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>TEAM ONLINE (SEARCHING)</div>
              <div className="font-heading text-cyan" style={{ fontSize: '1.4rem' }}>{waitingQueue.length}</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>ALL TEAMS</div>
              <div className="font-heading" style={{ fontSize: '1.4rem' }}>{teams.length}</div>
            </div>
          </div>

          <h4 className="font-heading text-danger" style={{ marginTop: '1rem', marginBottom: '0.75rem', fontSize: '1.1rem' }}>LIVE FIGHTING ({fightingTeams.length})</h4>
          {fightingTeams.map((t) => (
            <div key={t.id} className="flex justify-between items-center" style={{ padding: '0.75rem', background: 'rgba(255,51,102,0.04)', border: '1px solid rgba(255,51,102,0.2)', marginBottom: '0.5rem' }}>
              <div>
                <span className="font-heading" style={{ fontSize: '1.05rem' }}>{t.name}</span>
                <span className="badge badge-survival" style={{ marginLeft: '0.5rem' }}>{t.tokens} TKN</span>
              </div>
              <span className="badge badge-danger">FIGHTING</span>
            </div>
          ))}
          {fightingTeams.length === 0 && <p className="text-muted font-mono" style={{ marginBottom: '0.75rem' }}>No teams are currently fighting.</p>}

          <h4 className="font-heading text-warning" style={{ marginTop: '1rem', marginBottom: '0.75rem', fontSize: '1.1rem' }}>TEAM ONLINE (SEARCHING) ({waitingQueue.length})</h4>
          {queueDiagnostics.map(q => (
            <div key={q.teamId} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', marginBottom: '0.5rem', borderRadius: '8px' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                <div>
                  <span className="font-heading" style={{ fontSize: '1.1rem' }}>{q.teamName}</span>
                  <span className="badge badge-survival" style={{ marginLeft: '0.5rem' }}>{q.tokens} TKN</span>
                </div>
                <span className={`badge ${q.hasAnyPossibleMatch ? 'badge-cyan' : 'badge-warning'}`}>{q.hasAnyPossibleMatch ? 'SEARCHING...' : 'BLOCKED'}</span>
              </div>

              {q.blockers.length === 0 && (
                <div className="text-muted font-mono" style={{ fontSize: '0.75rem' }}>Waiting for another team to join queue.</div>
              )}

              {q.blockers.map((b) => (
                <div key={b.teamId} style={{ marginTop: '0.45rem', padding: '0.45rem 0.6rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                  <div className="font-mono" style={{ fontSize: '0.78rem' }}>
                    vs <span style={{ color: 'var(--text-main)' }}>{b.teamName}</span>: {b.canMatchNow ? 'Eligible now' : b.reasons.join(' | ')}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <h4 className="font-heading" style={{ marginTop: '1rem', marginBottom: '0.75rem', fontSize: '1.1rem' }}>ALL TEAMS SNAPSHOT</h4>
          {teams.map((t) => (
            <div key={t.id} className="flex justify-between items-center" style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-subtle)', marginBottom: '0.4rem', borderRadius: '8px' }}>
              <div>
                <span className="font-heading" style={{ fontSize: '1rem' }}>{t.name}</span>
                <span className="badge badge-survival" style={{ marginLeft: '0.5rem' }}>{t.tokens} TKN</span>
              </div>
              <span className={`badge badge-${t.status === 'eliminated' ? 'danger' : t.status === 'idle' ? 'survival' : t.status === 'fighting' ? 'danger' : t.status === 'timeout' ? 'warning' : 'cyan'}`}>{t.status.toUpperCase()}</span>
            </div>
          ))}

          {(matchmakingQueue || []).length === 0 && <p className="text-muted font-mono">No teams in queue.</p>}
        </div>
      )}

      {/* TAB: FIGHTING */}
      {tab === 'fighting' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 className="font-heading" style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>ACTIVE MATCHES</h3>
          {activeMatches.length === 0 && <p className="text-muted font-mono">No active matches.</p>}
          {activeMatches.map(m => (
            <div key={m.id} style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1rem' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
                <div className="flex items-center gap-2">
                  <span className="badge badge-danger">LIVE</span>
                  <span className="badge badge-survival">{m.domain}</span>
                  {m.isWager && <span className="badge badge-magenta">WAGER</span>}
                </div>
                <MatchTimer startTime={m.startTime} />
              </div>

              {m.domain === 'TBD' && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255, 201, 77, 0.05)', border: '1px solid var(--accent-warning)' }}>
                  <div className="text-warning font-mono mb-2" style={{ fontSize: '0.8rem' }}>⚡ Spin wheel to assign domain</div>
                  <DomainWheel
                    domains={domains}
                    resolveDomain={(selectedDomain) => handleSpinForMatch(m.id, selectedDomain)}
                    onSpin={(domain, payload) => {
                      const finalDomain = payload?.domain || domain;
                      setSpinResults(prev => ({ ...prev, [m.id]: finalDomain }));
                    }}
                  />
                </div>
              )}

              <div className="grid font-heading" style={{ gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="text-center"><div style={{ fontSize: '1.8rem' }}>{m.teamA.name}</div><div className="badge badge-survival">{m.teamA.tokens} TKN</div></div>
                <div style={{ fontSize: '2rem', color: 'var(--accent-danger)' }}>VS</div>
                <div className="text-center"><div style={{ fontSize: '1.8rem' }}>{m.teamB.name}</div><div className="badge badge-survival">{m.teamB.tokens} TKN</div></div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => declareWinner(m.id, m.teamA.id)}><Trophy size={16} /> {m.teamA.name} WINS</button>
                <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => declareWinner(m.id, m.teamB.id)}><Trophy size={16} /> {m.teamB.name} WINS</button>
              </div>
            </div>
          ))}

          {matchHistory.length > 0 && (
            <>
              <h4 className="font-heading" style={{ marginTop: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '1.25rem' }}>MATCH HISTORY</h4>
              {matchHistory.slice(0, 8).map(h => (
                <div key={h.id} className="flex justify-between items-center font-mono" style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.02)', fontSize: '0.85rem', marginBottom: '0.4rem', borderLeft: '2px solid var(--border-subtle)' }}>
                  <div><span className="text-survival" style={{ fontWeight: 700 }}>{h.winner}</span> beat <span className="text-danger">{h.loser}</span> in {h.domain}</div>
                  <span className={`badge ${h.isWager ? 'badge-magenta' : 'badge-warning'}`}>{h.isWager ? 'WAGER' : '±1'}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* TAB: SETTINGS */}
      {tab === 'settings' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 className="font-heading text-survival" style={{ marginBottom: '1.25rem', fontSize: '1.5rem' }}>MANAGE DOMAINS</h3>
            <div className="flex-col gap-3">
              <div className="flex gap-2">
                <input className="input" value={domainInput} onChange={e => setDomainInput(e.target.value)} placeholder="New Domain Name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (domainInput.trim() && !domains.includes(domainInput.trim())) { updateDomains([...domains, domainInput.trim()]); setDomainInput(''); } } }} />
                <button type="button" className="btn btn-primary" onClick={() => { if (domainInput.trim() && !domains.includes(domainInput.trim())) { updateDomains([...domains, domainInput.trim()]); setDomainInput(''); } }}><Plus size={16} /> Add</button>
              </div>
              <div className="flex-col gap-2 mt-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {domains.map((d, i) => (
                  <div key={i} className="flex justify-between items-center" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <span className="font-heading" style={{ fontSize: '1.1rem' }}>{d}</span>
                    <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem' }} onClick={() => updateDomains(domains.filter((_, idx) => idx !== i))}><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 className="font-heading text-warning" style={{ marginBottom: '1.25rem', fontSize: '1.5rem' }}>TIMEOUT DURATION</h3>
            <div className="flex-col gap-3">
              <div className="text-muted font-mono" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Set custom timeout duration in minutes. Currently: {gameState.timeoutDurationOverride ? (gameState.timeoutDurationOverride / 60000) + ' min (Overridden)' : 'Dynamic (5 or 15 min)'}
              </div>
              <div className="flex gap-2">
                <input className="input" type="number" value={timeoutInput} onChange={e => setTimeoutInput(e.target.value)} placeholder="Minutes (e.g. 10)" />
                <button type="button" className="btn btn-warning" onClick={() => { if (timeoutInput) { updateTimeout(Number(timeoutInput)); setTimeoutInput(''); } }}>Set Timeout</button>
                {gameState.timeoutDurationOverride && (
                  <button type="button" className="btn btn-ghost" onClick={() => updateTimeout(null)}>Reset to Default</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid-12" style={{ gap: '16px' }}>
        {[
          { label: 'TEAMS', val: teams.length, color: 'var(--text-main)' },
          { label: 'IN QUEUE', val: (matchmakingQueue || []).length, color: 'var(--accent-cyan)' },
          { label: 'ACTIVE MATCHES', val: activeMatches.length, color: 'var(--accent-danger)' },
          { label: 'PHASE', val: gameState.phase === 'phase2' ? '2' : '1', color: 'var(--accent-warning)' },
        ].map((s, i) => (
          <div key={i} className="card text-center" style={{ gridColumn: 'span 3', padding: '16px' }}>
            <div className="text-muted font-mono" style={{ fontSize: '12px', marginBottom: '8px' }}>{s.label}</div>
            <div className="tabular-nums font-heading" style={{ fontSize: '32px', color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminScreen;
