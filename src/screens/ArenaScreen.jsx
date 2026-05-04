import React from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Swords, ShieldAlert, Crosshair, Ban, Lock, Zap, Search, Timer } from 'lucide-react';
import { buildQueueDiagnostics } from '../utils/matchmaking';

const ArenaScreen = () => {
  const { teams, activeMatches, myTeam, gameState, isInQueue, joinQueue, matchmakingQueue, matchConstraints } = useGameState();

  if (!gameState.isGameActive && !gameState.isPaused) {
    return (
      <div className="panel text-center" style={{ padding: '64px' }}>
        <Lock size={48} className="text-warning mb-4" style={{ opacity: 0.6, margin: '0 auto' }} />
        <h2 className="text-warning mb-4">ARENA LOCKED</h2>
        <p className="text-muted">Awaiting admin authorization to commence.</p>
      </div>
    );
  }

  const amIEliminated = myTeam && myTeam.status === 'eliminated';
  const amITimeout = myTeam && myTeam.status === 'timeout';
  const amIBusy = myTeam && !['idle'].includes(myTeam.status);
  const isPaused = gameState.isPaused;
  const isPhase2 = gameState.phase === 'phase2';
  const autoJoinRequestedRef = React.useRef(false);

  const shouldAutoJoinQueue = Boolean(
    myTeam &&
    gameState.isGameActive &&
    !isPaused &&
    !amIEliminated &&
    !amITimeout &&
    myTeam.status === 'idle' &&
    !isInQueue
  );

  React.useEffect(() => {
    if (shouldAutoJoinQueue && !autoJoinRequestedRef.current) {
      autoJoinRequestedRef.current = true;
      joinQueue();
      return;
    }

    if (!shouldAutoJoinQueue || isInQueue) {
      autoJoinRequestedRef.current = false;
    }
  }, [shouldAutoJoinQueue, isInQueue, joinQueue]);

  const waitingQueue = React.useMemo(
    () => (matchmakingQueue || []).filter((q) => !q.matchedWith),
    [matchmakingQueue]
  );

  const queueDiagnostics = React.useMemo(
    () => buildQueueDiagnostics({ gameState, teams, matchmakingQueue, matchConstraints }),
    [gameState, teams, matchmakingQueue, matchConstraints]
  );

  const myQueueDiagnostics = React.useMemo(
    () => queueDiagnostics.find((q) => q.teamId === myTeam?.id) || null,
    [queueDiagnostics, myTeam]
  );

  const fightingTeams = React.useMemo(
    () => teams.filter((t) => t.status === 'fighting'),
    [teams]
  );

  return (
    <motion.div className="flex-col gap-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

      {/* Phase Banner */}
      <div style={{ padding: '12px 16px', background: isPhase2 ? 'rgba(255, 95, 143, 0.08)' : 'rgba(121, 255, 214, 0.05)', border: `1px solid ${isPhase2 ? 'var(--accent-magenta)' : 'rgba(121, 255, 214, 0.3)'}` }}>
        <span className={isPhase2 ? 'text-magenta' : 'text-cyan'} style={{ fontWeight: 600 }}>
          {isPhase2 ? '🔥 PHASE 2 — WAGER MODE · No limits · Winner takes all' : '📋 PHASE 1 — Standard · ±3 token range · +1/-1 stakes'}
        </span>
      </div>

      {isPaused && (
        <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--accent-warning)' }}>
          <span className="text-warning font-mono" style={{ fontSize: '14px' }}>⏸ GAME PAUSED — ALL SYSTEMS FROZEN.</span>
        </div>
      )}

      {/* Queue Action */}
      {myTeam && !amIEliminated && !amITimeout && (
        <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
          {isInQueue ? (
            <div>
              <Search size={48} className="text-cyan" style={{ margin: '0 auto 1rem', animation: 'pulseGlow 2s infinite' }} />
              <h2 className="font-heading text-cyan" style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>SEARCHING FOR MATCH...</h2>
              <p className="text-muted font-mono" style={{ marginBottom: '1.5rem' }}>
                {isPhase2 ? 'Wager mode: any team can be matched' : `Looking for teams within ±3 tokens of your ${myTeam.tokens} TKN`}
              </p>
            </div>
          ) : myTeam.status === 'matched' ? (
            <div>
              <Swords size={48} className="text-survival" style={{ margin: '0 auto 1rem' }} />
              <h2 className="font-heading text-survival" style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>MATCH FOUND!</h2>
              <p className="text-muted font-mono">Waiting for admin to spin the domain wheel and start the match.</p>
            </div>
          ) : myTeam.status === 'fighting' ? (
            <div>
              <Swords size={48} className="text-danger" style={{ margin: '0 auto 1rem', animation: 'pulseGlow 1.5s infinite' }} />
              <h2 className="font-heading text-danger" style={{ fontSize: '2rem' }}>IN MATCH!</h2>
              <p className="text-muted font-mono">Check the Battle tab for details.</p>
            </div>
          ) : (
            <div>
              <Crosshair size={56} className="text-survival" style={{ margin: '0 auto 1rem', opacity: 0.7 }} />
              <h2 className="font-heading" style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>AUTO-MATCH ENABLED</h2>
              <p className="text-muted font-mono" style={{ marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                You will be queued automatically and paired with an eligible opponent.
              </p>
              {(isPaused || amIBusy) && (
                <div className="text-muted font-mono" style={{ fontSize: '0.85rem' }}>
                  Matchmaking will resume automatically when your team is eligible.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isInQueue && myQueueDiagnostics && (
        <div className="panel" style={{ padding: '20px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
            <h3 className="font-heading text-warning" style={{ margin: 0, fontSize: '1.25rem' }}>SEARCH STATE REASONS</h3>
            <span className={`badge ${myQueueDiagnostics.hasAnyPossibleMatch ? 'badge-cyan' : 'badge-warning'}`}>
              {myQueueDiagnostics.hasAnyPossibleMatch ? 'Some teams are eligible' : 'Currently blocked'}
            </span>
          </div>
          {myQueueDiagnostics.blockers.length === 0 && (
            <div className="text-muted font-mono" style={{ fontSize: '0.82rem' }}>No opponent is searching right now. You will be matched as soon as one joins.</div>
          )}
          {myQueueDiagnostics.blockers.map((b) => (
            <div key={b.teamId} style={{ marginTop: '0.45rem', padding: '0.55rem 0.7rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <span className="font-mono" style={{ fontSize: '0.78rem' }}>
                vs {b.teamName}: {b.canMatchNow ? 'Eligible now' : b.reasons.join(' | ')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ padding: '20px' }}>
        <div className="grid-12" style={{ gap: '12px' }}>
          <div style={{ gridColumn: 'span 4', padding: '12px', background: 'rgba(255,51,102,0.05)', border: '1px solid rgba(255,51,102,0.2)', borderRadius: '10px' }}>
            <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>LIVE TEAM FIGHTING</div>
            <div className="font-heading text-danger" style={{ fontSize: '1.35rem' }}>{fightingTeams.length}</div>
          </div>
          <div style={{ gridColumn: 'span 4', padding: '12px', background: 'rgba(121,255,214,0.05)', border: '1px solid rgba(121,255,214,0.2)', borderRadius: '10px' }}>
            <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>TEAM ONLINE (SEARCHING)</div>
            <div className="font-heading text-cyan" style={{ fontSize: '1.35rem' }}>{waitingQueue.length}</div>
          </div>
          <div style={{ gridColumn: 'span 4', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
            <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>ALL TEAMS</div>
            <div className="font-heading" style={{ fontSize: '1.35rem' }}>{teams.length}</div>
          </div>
        </div>
      </div>

      {/* Timeout Banner */}
      {amITimeout && myTeam.timeoutUntil && (
        <div className="panel text-center" style={{ padding: '32px', border: '1px solid var(--accent-warning)' }}>
          <Timer size={48} className="text-warning" style={{ margin: '0 auto 1rem' }} />
          <h2 className="font-heading text-warning" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>TIMEOUT</h2>
          <p className="text-muted font-mono" style={{ marginBottom: '1rem' }}>You hit 0 tokens. Wait for the timeout to expire and you'll reset to 1 token.</p>
          <TimeoutCountdown until={myTeam.timeoutUntil} />
        </div>
      )}

      {/* Eliminated Banner */}
      {amIEliminated && (
        <div className="panel text-center" style={{ padding: '32px', border: '1px solid var(--accent-danger)' }}>
          <Ban size={48} className="text-danger" style={{ margin: '0 auto 1rem' }} />
          <h2 className="font-heading text-danger" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ELIMINATED</h2>
          <p className="text-muted font-mono">You have been permanently eliminated. Spectate the remaining matches.</p>
        </div>
      )}

      {/* Live Matches */}
      <div className="panel glow-danger" style={{ padding: '24px' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-danger">
            <Swords className="animate-pulse" />
            <h2 className="m-0 text-danger" style={{ margin: 0 }}>LIVE MATCHES</h2>
          </div>
          <div className="badge badge-danger">{activeMatches.length} ACTIVE</div>
        </div>

        <div className="grid-12" style={{ gap: '16px' }}>
          {activeMatches.map(match => (
            <div key={match.id} style={{ gridColumn: 'span 4', background: 'rgba(255,51,102,0.05)', padding: '20px', border: '1px solid rgba(255,51,102,0.2)', borderRadius: 'var(--radius-md)' }}>
              <div className="flex justify-between items-center mb-4">
                <span className="badge badge-survival">{match.domain}</span>
                <span className={`badge ${match.isWager ? 'badge-magenta' : 'badge-warning'}`}>{match.isWager ? 'WAGER' : '±1'}</span>
              </div>
              <div className="flex justify-between items-center text-center">
                <div className="font-heading" style={{ flex: 1, fontSize: '1.4rem' }}>{match.teamA.name}</div>
                <div className="font-heading text-danger" style={{ padding: '0 12px', fontSize: '1.8rem' }}>VS</div>
                <div className="font-heading" style={{ flex: 1, fontSize: '1.4rem' }}>{match.teamB.name}</div>
              </div>
            </div>
          ))}
          {activeMatches.length === 0 && (
            <div className="text-muted text-center font-mono" style={{ gridColumn: 'span 12', padding: '32px' }}>
              NO LIVE MATCHES AT THIS TIME.
            </div>
          )}
        </div>
      </div>

      {/* All Teams */}
      <div className="panel" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2 mb-6">
          <Crosshair className="text-survival" />
          <h2 className="m-0 font-heading tracking-wider text-xl" style={{ margin: 0 }}>ALL TEAMS</h2>
        </div>
        <div className="grid-12" style={{ gap: '16px' }}>
          {teams.filter(t => !myTeam || t.id !== myTeam.id).map(team => {
            const isEliminated = team.status === 'eliminated';
            const isTimeout = team.status === 'timeout';
            return (
              <div key={team.id} style={{
                gridColumn: 'span 4', padding: '16px',
                background: isEliminated ? 'rgba(255, 59, 59, 0.05)' : isTimeout ? 'rgba(255, 201, 77, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isEliminated ? 'var(--accent-danger)' : isTimeout ? 'var(--accent-warning)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)', opacity: isEliminated ? 0.5 : 1
              }}>
                <div className="flex justify-between items-center mb-2">
                  <div className="font-heading" style={{ fontSize: '1.3rem', color: isEliminated ? 'var(--accent-danger)' : 'inherit', textDecoration: isEliminated ? 'line-through' : 'none' }}>{team.name}</div>
                  <span className={`badge badge-${isEliminated ? 'danger' : isTimeout ? 'warning' : team.status === 'idle' ? 'survival' : team.status === 'fighting' ? 'danger' : 'cyan'}`}>
                    {team.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className={`badge ${isEliminated ? 'badge-danger' : 'badge-survival'}`}>{team.tokens} TKN</div>
                  <div className="text-muted font-mono" style={{ fontSize: '0.75rem' }}>{team.members} members</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Timeout countdown component
const TimeoutCountdown = ({ until }) => {
  const [display, setDisplay] = React.useState('');
  React.useEffect(() => {
    const tick = () => {
      const left = Math.max(0, until - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setDisplay(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [until]);
  return <div className="game-timer" style={{ fontSize: '2rem', display: 'inline-block' }}>{display}</div>;
};

export default ArenaScreen;
