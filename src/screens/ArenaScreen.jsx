import React from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Swords, Crosshair, Ban, Lock, Zap, Search, Timer, Skull, VenetianMask } from 'lucide-react';
import { buildQueueDiagnostics } from '../utils/matchmaking';
import './AdminScreen.css';

const ArenaScreen = () => {
  const { teams, activeMatches, myTeam, gameState, isInQueue, myQueueEntry, joinQueue, matchmakingQueue, matchConstraints } = useGameState();

  if (!gameState.isGameActive && !gameState.isPaused) {
    return (
      <div className="panel-container border-2 border-gray-600 p-12 text-center relative z-10 heist-bg">
        <Lock size={64} className="text-gray-500 mb-6 mx-auto" />
        <h2 className="heist-font text-heist-yellow text-4xl mb-2 tracking-widest">ARENA LOCKED</h2>
        <p className="heist-mono text-gray-400 text-lg">Awaiting The Professor's authorization to commence.</p>
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

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <motion.div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 min-h-screen heist-bg text-white pb-20 relative overflow-hidden" variants={containerVariants} initial="hidden" animate="visible">
      
      {/* Background elements */}
      <div className="absolute inset-0 bg-blueprint opacity-10 pointer-events-none z-0"></div>

      {/* Phase Banner */}
      <motion.div variants={itemVariants} className={`panel-container border-2 p-4 relative z-10 ${isPhase2 ? 'border-heist-red bg-red-900 bg-opacity-20' : 'border-heist-teal bg-teal-900 bg-opacity-20'}`}>
        <span className={`heist-font text-2xl tracking-widest ${isPhase2 ? 'text-heist-red' : 'text-heist-teal'}`}>
          {isPhase2 ? '🔥 PHASE 2 — WAGER MODE · NO LIMITS · WINNER TAKES ALL' : '📋 PHASE 1 — STANDARD MODE · ±3 TOKEN RANGE · +1/-1 STAKES'}
        </span>
      </motion.div>

      {isPaused && (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-yellow bg-yellow-900 bg-opacity-20 p-4 relative z-10">
          <span className="heist-font text-heist-yellow text-2xl tracking-widest">⏸ OPERATION PAUSED — ALL SYSTEMS FROZEN.</span>
        </motion.div>
      )}

      {/* Queue Action */}
      {myTeam && !amIEliminated && !amITimeout && (
        <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-8 text-center relative z-10 overflow-hidden shadow-2xl">
          {/* subtle background pulse if in queue */}
          {isInQueue && !myQueueEntry?.matchedWith && <div className="absolute inset-0 bg-heist-teal opacity-5 animate-pulse pointer-events-none"></div>}

          {isInQueue ? (
            myQueueEntry?.matchedWith ? (
              <div className="flex flex-col items-center">
                <Swords size={64} className="text-heist-red mb-4 animate-pulse" />
                <h2 className="heist-font text-heist-red text-5xl mb-2 tracking-widest">TARGET ACQUIRED!</h2>
                <div className="heist-mono text-xl mb-4 p-4 border-2 border-heist-red bg-black bg-opacity-70 inline-flex items-center gap-4">
                  <span className="text-gray-500">VS</span> 
                  <span className="text-white text-2xl font-bold">{teams.find(t => t.id === myQueueEntry.matchedWith)?.name || 'UNKNOWN CREW'}</span>
                </div>
                <p className="heist-mono text-gray-400 text-lg uppercase">Proceed to the briefing room for the Domain Spin immediately.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Search size={64} className="text-heist-teal mb-4 animate-pulse" />
                <h2 className="heist-font text-heist-teal text-4xl mb-2 tracking-widest">HUNTING FOR TARGET...</h2>
                <p className="heist-mono text-gray-400 text-lg uppercase mb-6">
                  {isPhase2 ? 'WAGER MODE: ANY CREW CAN BE TARGETED' : `SCANNING FOR CREWS WITHIN ±3 TOKENS OF YOUR ${myTeam.tokens} TKN`}
                </p>
              </div>
            )
          ) : myTeam.status === 'fighting' ? (
            <div className="flex flex-col items-center">
              <Swords size={64} className="text-heist-red mb-4 animate-bounce" />
              <h2 className="heist-font text-heist-red text-5xl mb-2 tracking-widest">INFILTRATION ACTIVE!</h2>
              <p className="heist-mono text-gray-400 text-lg uppercase">Monitor the Battle feed for live intel.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Crosshair size={64} className="text-heist-teal mb-4 opacity-70" />
              <h2 className="heist-font text-white text-4xl mb-2 tracking-widest">AUTO-MATCH ENGAGED</h2>
              <p className="heist-mono text-gray-400 text-lg uppercase max-w-lg mx-auto mb-6">
                You will be queued automatically and paired with an eligible target.
              </p>
              {(isPaused || amIBusy) && (
                <div className="heist-mono text-heist-yellow text-sm uppercase">
                  Matchmaking will resume automatically when your crew is cleared.
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Queue Diagnostics */}
      {isInQueue && myQueueDiagnostics && (
        <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-6 relative z-10">
          <div className="flex items-center justify-between mb-4 border-b-2 border-gray-700 pb-3">
            <h3 className="heist-font text-heist-yellow text-2xl tracking-widest m-0">SCAN DIAGNOSTICS</h3>
            <span className={`px-3 py-1 heist-mono text-xs uppercase border ${myQueueDiagnostics.hasAnyPossibleMatch ? 'border-heist-teal text-heist-teal' : 'border-heist-yellow text-heist-yellow'}`}>
              {myQueueDiagnostics.hasAnyPossibleMatch ? 'TARGETS ELIGIBLE' : 'SCAN BLOCKED'}
            </span>
          </div>
          {myQueueDiagnostics.blockers.length === 0 && (
            <div className="heist-mono text-gray-400 text-sm uppercase">No rival crews scanning right now. You will be matched upon detection.</div>
          )}
          <div className="flex flex-col gap-2">
            {myQueueDiagnostics.blockers.map((b) => (
              <div key={b.teamId} className="p-3 border border-gray-800 bg-black bg-opacity-50">
                <span className="heist-mono text-sm uppercase">
                  <span className="text-gray-500">VS</span> <span className="text-white">{b.teamName}:</span> {b.canMatchNow ? <span className="text-heist-teal">Eligible now</span> : <span className="text-heist-red">{b.reasons.join(' | ')}</span>}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-heist-red bg-red-900 bg-opacity-10 text-center">
            <div className="heist-mono text-gray-400 text-xs uppercase mb-1">CREWS IN COMBAT</div>
            <div className="heist-font text-heist-red text-4xl">{fightingTeams.length}</div>
          </div>
          <div className="p-4 border border-heist-teal bg-teal-900 bg-opacity-10 text-center">
            <div className="heist-mono text-gray-400 text-xs uppercase mb-1">CREWS SCANNING</div>
            <div className="heist-font text-heist-teal text-4xl">{waitingQueue.length}</div>
          </div>
          <div className="p-4 border border-gray-600 bg-gray-900 bg-opacity-30 text-center">
            <div className="heist-mono text-gray-400 text-xs uppercase mb-1">TOTAL CREWS</div>
            <div className="heist-font text-white text-4xl">{teams.length}</div>
          </div>
        </div>
      </motion.div>

      {/* Timeout Banner */}
      {amITimeout && myTeam.timeoutUntil && (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-yellow p-8 text-center relative z-10 bg-black">
          <Timer size={64} className="text-heist-yellow mb-4 mx-auto animate-pulse" />
          <h2 className="heist-font text-heist-yellow text-5xl mb-2 tracking-widest">TIMEOUT</h2>
          <p className="heist-mono text-gray-400 text-lg uppercase mb-6">You hit 0 tokens. Wait for the timeout to expire and you'll reset to 1 token.</p>
          <TimeoutCountdown until={myTeam.timeoutUntil} />
        </motion.div>
      )}

      {/* Eliminated Banner */}
      {amIEliminated && (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-red p-8 text-center relative z-10 bg-black">
          <Ban size={64} className="text-heist-red mb-4 mx-auto" />
          <h2 className="heist-font text-heist-red text-5xl mb-2 tracking-widest">ELIMINATED</h2>
          <p className="heist-mono text-gray-400 text-lg uppercase">You have been permanently eliminated. Spectate the remaining operations.</p>
        </motion.div>
      )}

      {/* Live Matches */}
      <motion.div variants={itemVariants} className="panel-container border-2 border-heist-red p-6 relative z-10 shadow-[0_0_20px_rgba(211,47,47,0.2)]">
        <div className="flex items-center justify-between mb-6 border-b-2 border-heist-red pb-3">
          <div className="flex items-center gap-3">
            <Swords className="text-heist-red animate-pulse" size={28} />
            <h2 className="heist-font text-heist-red text-3xl tracking-wider m-0">LIVE OPERATIONS</h2>
          </div>
          <div className="px-3 py-1 bg-heist-red text-white heist-mono text-sm">{activeMatches.length} ACTIVE</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeMatches.map(match => (
            <div key={match.id} className="p-4 border border-heist-red bg-black bg-opacity-70 relative overflow-hidden group">
              {/* background scanline */}
              <div className="absolute top-0 left-0 w-full h-1 bg-heist-red opacity-50 transform -translate-y-full group-hover:animate-scanline"></div>
              
              <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                <span className="px-2 py-1 border border-heist-teal text-heist-teal heist-mono text-[10px] uppercase">{match.domain}</span>
                <span className={`px-2 py-1 heist-mono text-[10px] uppercase ${match.isWager ? 'bg-heist-red text-white' : 'border border-heist-yellow text-heist-yellow'}`}>{match.isWager ? 'WAGER' : '±1'}</span>
              </div>
              <div className="flex justify-between items-center text-center">
                <div className="heist-font text-2xl text-white flex-1 truncate">{match.teamA.name}</div>
                <div className="heist-font text-heist-red text-3xl px-3">VS</div>
                <div className="heist-font text-2xl text-white flex-1 truncate">{match.teamB.name}</div>
              </div>
            </div>
          ))}
          {activeMatches.length === 0 && (
            <div className="heist-mono text-gray-500 uppercase col-span-full text-center py-8">
              NO LIVE OPERATIONS AT THIS TIME.
            </div>
          )}
        </div>
      </motion.div>

      {/* All Teams */}
      <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-6 relative z-10 bg-black bg-opacity-80">
        <div className="flex items-center gap-3 mb-6 border-b-2 border-gray-700 pb-3">
          <Crosshair className="text-heist-teal" size={28} />
          <h2 className="heist-font text-white text-3xl tracking-wider m-0">ALL CREWS</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teams.filter(t => !myTeam || t.id !== myTeam.id).map(team => {
            const isEliminated = team.status === 'eliminated';
            const isTimeout = team.status === 'timeout';
            return (
              <div key={team.id} className={`p-4 border ${isEliminated ? 'border-heist-red bg-red-900 bg-opacity-10' : isTimeout ? 'border-heist-yellow bg-yellow-900 bg-opacity-10' : 'border-gray-800 hover:border-gray-500'} transition-colors relative`}>
                <div className="flex justify-between items-center mb-3">
                  <div className={`heist-font text-2xl truncate pr-2 ${isEliminated ? 'text-heist-red line-through' : 'text-white'}`}>{team.name}</div>
                  <span className={`px-2 py-0.5 heist-mono text-[10px] uppercase border ${isEliminated ? 'border-heist-red text-heist-red' : isTimeout ? 'border-heist-yellow text-heist-yellow' : team.status === 'idle' ? 'border-heist-teal text-heist-teal' : team.status === 'fighting' ? 'border-heist-red bg-heist-red text-white' : 'border-gray-500 text-gray-500'}`}>
                    {team.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className={`px-2 py-1 heist-font text-xl ${isEliminated ? 'text-heist-red' : 'text-heist-yellow border-b border-heist-yellow'}`}>{team.tokens} TKN</div>
                  <div className="heist-mono text-gray-500 text-[10px] uppercase">{team.members} members</div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
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
  return <div className="heist-font text-white tracking-widest" style={{ fontSize: '4rem', display: 'inline-block' }}>{display}</div>;
};

export default ArenaScreen;
