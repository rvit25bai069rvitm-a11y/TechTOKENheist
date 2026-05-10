import React from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Swords, Crosshair, Ban, Lock, Zap, Search, Timer, ShieldAlert, AlertCircle, Users } from 'lucide-react';
import { buildQueueDiagnostics } from '../utils/matchmaking';

const ArenaScreen = () => {
  const { teams, activeMatches, myTeam, gameState, isInQueue, myQueueEntry, joinQueue, matchmakingQueue, matchConstraints } = useGameState();

  if (!gameState.isGameActive && !gameState.isPaused) {
    return (
      <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-red-900/30 rounded-sm p-16 text-center shadow-2xl h-full flex flex-col justify-center items-center">
        <Lock size={64} className="text-gray-600 mb-6 mx-auto" />
        <h2 className="heist-font text-gray-400 text-5xl mb-4 tracking-widest uppercase">ARENA LOCKED</h2>
        <p className="heist-mono text-gray-500 text-sm tracking-widest uppercase max-w-md mx-auto">Awaiting The Professor's authorization to commence matchmaking.</p>
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
    <motion.div className="flex flex-col gap-8 text-white pb-20 relative h-full" variants={containerVariants} initial="hidden" animate="visible">
      
      {/* Header Section */}
      <motion.div variants={itemVariants} className="heist-header-tactical flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="heist-title-main">TACTICAL <span className="heist-title-accent">ARENA</span></h1>
          <span className="heist-subtitle-mono">NEURAL NETWORK MATCHMAKING SYSTEM</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`heist-card px-6 py-3 flex items-center gap-4 border-l-4 ${isPhase2 ? 'border-l-red-600' : 'border-l-gray-600'}`}>
            <div className="flex flex-col">
              <span className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1">CURRENT SECTOR</span>
              <span className={`heist-font text-2xl tracking-widest uppercase ${isPhase2 ? 'text-red-500' : 'text-gray-300'}`}>
                {isPhase2 ? 'PHASE 2: WAGER' : 'PHASE 1: STANDARD'}
              </span>
            </div>
            {isPhase2 ? <Zap className="text-red-500 animate-pulse" size={24} /> : <ShieldAlert className="text-gray-400" size={24} />}
          </div>
        </div>
      </motion.div>

      {isPaused && (
        <motion.div variants={itemVariants} className="heist-card border-red-600/50 bg-red-950/10 p-6 flex items-center gap-6 relative">
          <div className="scanline-overlay"></div>
          <div className="p-3 bg-red-600/20 rounded-sm">
            <Lock className="text-red-600" size={32} />
          </div>
          <div>
            <span className="heist-font text-red-500 text-3xl tracking-widest uppercase block mb-1">SYSTEMS FROZEN</span>
            <span className="heist-mono text-gray-400 text-[10px] tracking-widest uppercase">ALL OPERATIONS SUSPENDED BY THE PROFESSOR</span>
          </div>
        </motion.div>
      )}

      {/* Primary Action Card */}
      {myTeam && !amIEliminated && !amITimeout && (
        <motion.div variants={itemVariants} className="heist-card relative overflow-hidden group">
          <div className="scanline-overlay"></div>
          <div className="blueprint-grid absolute inset-0 opacity-20"></div>
          
          <div className="heist-card-content min-h-[350px] flex flex-col items-center justify-center relative z-10 p-12 text-center">
            {isInQueue && !myQueueEntry?.matchedWith && (
              <div className="absolute inset-0 bg-red-600/5 animate-pulse pointer-events-none"></div>
            )}

            {isInQueue ? (
              myQueueEntry?.matchedWith ? (
                <div className="flex flex-col items-center w-full">
                  <div className="relative mb-8">
                    <Swords size={80} className="text-red-600 animate-pulse" />
                    <div className="absolute inset-0 border-4 border-red-600 rounded-full animate-ping opacity-20"></div>
                  </div>
                  
                  <h2 className="heist-font text-white text-7xl mb-6 tracking-tighter uppercase">TARGET <span className="text-red-600">LOCKED</span></h2>
                  
                  <div className="flex flex-col md:flex-row items-center gap-12 mb-10 w-full max-w-4xl justify-center">
                    <div className="flex flex-col items-center">
                      <span className="heist-mono text-gray-500 text-[10px] mb-2 uppercase tracking-widest">FRIENDLY</span>
                      <span className="heist-font text-4xl text-white tracking-widest uppercase">{myTeam.name}</span>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <div className="h-px w-20 bg-red-900 mb-4"></div>
                      <span className="heist-mono text-red-500 text-xl font-bold px-6 py-2 border border-red-600/30 bg-red-950/20">VERSUS</span>
                      <div className="h-px w-20 bg-red-900 mt-4"></div>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <span className="heist-mono text-gray-500 text-[10px] mb-2 uppercase tracking-widest">HOSTILE</span>
                      <span className="heist-font text-4xl text-red-600 tracking-widest uppercase">
                        {teams.find(t => t.id === myQueueEntry.matchedWith)?.name || 'IDENTIFYING...'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="heist-badge badge-red px-8 py-2 animate-pulse">
                    PROCEED TO BRIEFING STATION IMMEDIATELY
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative mb-10">
                    <div className="absolute -inset-12 border border-red-600/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                    <div className="absolute -inset-8 border border-red-600/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                    <Search size={80} className="text-red-600 opacity-80" />
                  </div>
                  
                  <h2 className="heist-font text-white text-6xl mb-4 tracking-widest uppercase">SCANNING <span className="text-red-600">SIGNALS</span></h2>
                  <p className="heist-mono text-gray-400 text-xs tracking-[0.3em] uppercase mb-8">
                    {isPhase2 ? 'ANY TARGET DETECTED IS ELIGIBLE' : 'FILTERING BY TKN PROXIMITY'}
                  </p>
                  
                  <div className="w-80 h-1 bg-white/5 relative overflow-hidden rounded-full">
                    <motion.div 
                      className="absolute top-0 left-0 h-full w-1/3 bg-red-600"
                      animate={{ left: ['-33%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>
              )
            ) : myTeam.status === 'fighting' ? (
              <div className="flex flex-col items-center">
                <div className="p-8 bg-red-950/30 border border-red-600 rounded-sm mb-8 pulse-red">
                  <Swords size={80} className="text-red-600" />
                </div>
                <h2 className="heist-font text-red-600 text-7xl mb-4 tracking-tighter uppercase">INFILTRATION ACTIVE</h2>
                <p className="heist-mono text-gray-400 text-xs tracking-[0.2em] uppercase">MONITORING LIVE INTEL FEED</p>
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                <Crosshair size={80} className="text-gray-500 mb-8" />
                <h2 className="heist-font text-gray-400 text-6xl mb-4 tracking-widest uppercase">AUTO-QUEUED</h2>
                <p className="heist-mono text-gray-500 text-xs tracking-[0.2em] uppercase max-w-xl mx-auto leading-relaxed">
                  SYSTEM IS SCANNING FOR ELIGIBLE TARGETS. YOUR CREW WILL BE DEPLOYED AUTOMATICALLY UPON DETECTION.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Queue Diagnostics */}
      {isInQueue && myQueueDiagnostics && (
        <motion.div variants={itemVariants} className="heist-card">
          <div className="heist-card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="text-gray-400" size={20} />
              <h3 className="heist-font text-gray-200 text-2xl tracking-widest m-0 uppercase">NETWORK DIAGNOSTICS</h3>
            </div>
            <div className={`heist-badge ${myQueueDiagnostics.hasAnyPossibleMatch ? 'badge-teal' : 'badge-red'}`}>
              {myQueueDiagnostics.hasAnyPossibleMatch ? 'TARGETS ELIGIBLE' : 'SCAN BLOCKED'}
            </div>
          </div>
          
          <div className="heist-card-content">
            {myQueueDiagnostics.blockers.length === 0 && (
              <div className="heist-mono text-gray-500 text-xs uppercase tracking-widest flex items-center gap-3 py-4 justify-center bg-white/5 border border-white/5 mb-4">
                <AlertCircle size={16} /> NO HOSTILE CREWS DETECTED IN NETWORK RANGE
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myQueueDiagnostics.blockers.map((b) => (
                <div key={b.teamId} className="p-4 border border-white/5 bg-black/40 flex justify-between items-center group hover:border-white/20 transition-all">
                  <div className="flex flex-col">
                    <span className="heist-mono text-[10px] text-gray-600 uppercase mb-1">RIVAL CREW</span>
                    <span className="heist-font text-xl tracking-widest text-white group-hover:text-red-500 transition-colors">{b.teamName}</span>
                  </div>
                  <div className={`heist-badge ${b.canMatchNow ? 'badge-teal' : 'badge-red'} text-[9px]`}>
                    {b.canMatchNow ? 'LOCK POSSIBLE' : b.reasons[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Readout */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'ACTIVE OPERATIONS', value: fightingTeams.length, icon: <Swords size={20}/>, color: 'text-red-600' },
          { label: 'CREWS SCANNING', value: waitingQueue.length, icon: <Search size={20}/>, color: 'text-white' },
          { label: 'REGISTERED CREWS', value: teams.length, icon: <Users size={20}/>, color: 'text-gray-500' }
        ].map((stat, i) => (
          <div key={i} className="heist-card p-6 flex flex-col items-center text-center">
            <div className={`mb-4 p-3 bg-white/5 rounded-sm ${stat.color} opacity-80`}>
              {stat.icon}
            </div>
            <span className="heist-mono text-[10px] text-gray-600 tracking-[0.2em] uppercase mb-2">{stat.label}</span>
            <div className={`heist-font text-6xl ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Live Matches Grid */}
      <motion.div variants={itemVariants} className="heist-card">
        <div className="heist-card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <h2 className="heist-font text-white text-3xl tracking-widest m-0 uppercase">LIVE INTEL FEED</h2>
          </div>
          <div className="heist-badge badge-red">{activeMatches.length} OPERATIONS ACTIVE</div>
        </div>

        <div className="heist-card-content">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeMatches.map(match => (
              <div key={match.id} className="heist-card bg-black/60 border-white/5 hover:border-red-600/30 transition-all p-6 group">
                <div className="flex justify-between items-center mb-6">
                  <span className="heist-badge badge-gray text-[8px]">{match.domain}</span>
                  <span className={`heist-badge ${match.isWager ? 'badge-red' : 'badge-teal'} text-[8px]`}>
                    {match.isWager ? 'WAGER' : 'STANDARD'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-center gap-4">
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <div className="heist-font text-xl text-white truncate w-full tracking-widest">{match.teamA.name}</div>
                    <div className="heist-mono text-[8px] text-gray-600 mt-1 uppercase">ASSAULT</div>
                  </div>
                  <div className="heist-font text-red-600 text-xl font-bold group-hover:scale-125 transition-transform">VS</div>
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <div className="heist-font text-xl text-white truncate w-full tracking-widest">{match.teamB.name}</div>
                    <div className="heist-mono text-[8px] text-gray-600 mt-1 uppercase">DEFENSE</div>
                  </div>
                </div>
              </div>
            ))}
            {activeMatches.length === 0 && (
              <div className="heist-mono text-gray-700 text-xs tracking-widest uppercase col-span-full text-center py-20 bg-white/2 border border-dashed border-white/5">
                NO ACTIVE OPERATIONS DETECTED IN THE GRID.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Penalty States */}
      {(amITimeout || amIEliminated) && (
        <motion.div variants={itemVariants} className="heist-card border-red-900/50 p-12 text-center bg-red-950/10">
          <div className="scanline-overlay"></div>
          {amITimeout ? (
             <>
               <Timer size={80} className="text-yellow-500 mb-8 mx-auto animate-pulse" />
               <h2 className="heist-font text-yellow-500 text-7xl mb-4 tracking-tighter uppercase">TIMEOUT ACTIVE</h2>
               <p className="heist-mono text-gray-400 text-xs tracking-[0.2em] uppercase mb-12 max-w-xl mx-auto leading-relaxed">
                 RESOURCES DEPLETED. SYSTEM RECALIBRATION IN PROGRESS. STANDBY FOR AUTOMATIC RESET.
               </p>
               <TimeoutCountdown until={myTeam.timeoutUntil} />
             </>
          ) : (
            <>
              <Ban size={80} className="text-red-600 mb-8 mx-auto" />
              <h2 className="heist-font text-red-600 text-7xl mb-4 tracking-tighter uppercase">TERMINATED</h2>
              <p className="heist-mono text-gray-400 text-xs tracking-[0.2em] uppercase leading-relaxed">
                YOUR PERMIT HAS BEEN REVOKED. OPERATION OVER.
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* All Teams Grid */}
      <motion.div variants={itemVariants} className="heist-card mb-12">
        <div className="heist-card-header flex items-center gap-3">
          <Users className="text-gray-400" size={24} />
          <h2 className="heist-font text-white text-3xl tracking-widest m-0 uppercase">CREW ROSTER</h2>
        </div>
        <div className="heist-card-content">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teams.filter(t => !myTeam || t.id !== myTeam.id).map(team => {
              const isEliminated = team.status === 'eliminated';
              const isTimeout = team.status === 'timeout';
              const isFighting = team.status === 'fighting';
              
              return (
                <div key={team.id} className={`p-5 heist-card transition-all duration-300 ${
                  isEliminated ? 'opacity-40 grayscale' : 
                  isFighting ? 'border-red-600/30' : 'hover:border-white/20'
                }`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col min-w-0">
                      <span className={`heist-font text-xl truncate tracking-widest uppercase ${isEliminated ? 'text-red-600 line-through' : 'text-white'}`}>
                        {team.name}
                      </span>
                      <span className="heist-mono text-[8px] text-gray-600 tracking-widest uppercase">{team.members} OPERATIVES</span>
                    </div>
                    <div className={`heist-badge ${
                      isEliminated ? 'badge-red' : 
                      isTimeout ? 'badge-red' : 
                      isFighting ? 'badge-red animate-pulse' : 
                      'badge-gray'
                    } text-[7px]`}>
                      {team.status}
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className={`heist-font text-4xl leading-none ${isEliminated ? 'text-red-900' : 'text-white'}`}>
                      {team.tokens} <span className="text-xs text-gray-600">TKN</span>
                    </div>
                    {isFighting && <Swords size={16} className="text-red-600" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

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
  return <div className="heist-font text-yellow-500 tracking-widest text-7xl">{display}</div>;
};

export default ArenaScreen;
