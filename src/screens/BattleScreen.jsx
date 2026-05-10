import React from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Target, Skull, Timer, ShieldAlert, Swords, Lock, Search, Zap } from 'lucide-react';

const MatchTimer = ({ startTime }) => {
  const [display, setDisplay] = React.useState('0:00');
  React.useEffect(() => {
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
  return <span className="heist-font text-red-500 tracking-widest text-4xl drop-shadow-md">{display}</span>;
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

const BattleScreen = () => {
  const { myTeam, currentActiveMatch, gameState, isInQueue } = useGameState();

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  const renderContent = () => {
    if (!gameState.isGameActive && !gameState.isPaused) {
      return (
        <motion.div variants={itemVariants} className="heist-card min-h-[400px] flex flex-col justify-center items-center p-16 text-center">
          <div className="scanline-overlay"></div>
          <Lock size={80} className="text-gray-700 mb-8 opacity-50" />
          <h2 className="heist-font text-gray-500 text-6xl mb-4 tracking-widest uppercase">BATTLE LOCKED</h2>
          <p className="heist-mono text-gray-600 text-xs tracking-[0.3em] uppercase max-w-md mx-auto">
            AWAITING AUTHORIZATION FROM THE PROFESSOR TO COMMENCE OPERATIONS.
          </p>
        </motion.div>
      );
    }

    if (gameState.isPaused) {
      return (
        <motion.div variants={itemVariants} className="heist-card border-red-600/50 bg-red-950/10 min-h-[400px] flex flex-col justify-center items-center p-16 text-center">
          <div className="scanline-overlay"></div>
          <ShieldAlert size={80} className="text-red-600 mb-8 animate-pulse" />
          <h2 className="heist-font text-red-600 text-6xl mb-4 tracking-widest uppercase">OPERATION PAUSED</h2>
          <p className="heist-mono text-gray-400 text-xs tracking-[0.3em] uppercase">
            ALL NEURAL LINKS SEVERED. SYSTEMS ON STANDBY.
          </p>
        </motion.div>
      );
    }

    // Timeout state
    if (myTeam?.status === 'timeout' && myTeam.timeoutUntil) {
      return (
        <motion.div variants={itemVariants} className="heist-card border-red-900/50 p-16 text-center bg-red-950/10 min-h-[400px] flex flex-col justify-center items-center">
          <div className="scanline-overlay"></div>
          <Timer size={100} className="text-red-600 mb-10 animate-pulse" />
          <h2 className="heist-font text-red-600 text-7xl mb-6 tracking-tighter uppercase">TIMEOUT</h2>
          <p className="heist-mono text-gray-400 text-xs tracking-[0.2em] uppercase max-w-xl mx-auto mb-12 leading-relaxed">
            RESOURCES DEPLETED. SYSTEM RECALIBRATION IN PROGRESS. STANDBY FOR AUTOMATIC RESET.
          </p>
          <TimeoutCountdown until={myTeam.timeoutUntil} />
          <div className="heist-mono text-gray-600 text-[10px] uppercase mt-6 tracking-[0.4em]">TIME UNTIL RESET</div>
        </motion.div>
      );
    }

    // Eliminated state
    if (myTeam?.status === 'eliminated') {
      return (
        <motion.div variants={itemVariants} className="heist-card border-red-900/50 p-16 text-center bg-red-950/10 min-h-[400px] flex flex-col justify-center items-center">
          <div className="scanline-overlay"></div>
          <Skull size={100} className="text-red-900 mb-10 opacity-60" />
          <h2 className="heist-font text-red-900 text-8xl mb-6 tracking-tighter uppercase">TERMINATED</h2>
          <p className="heist-mono text-gray-500 text-xs tracking-[0.2em] uppercase leading-relaxed">
            YOUR CREDENTIALS HAVE BEEN WIPED FROM THE SYSTEM.
          </p>
        </motion.div>
      );
    }

    // Active Fight
    if (currentActiveMatch) {
      return (
        <motion.div variants={itemVariants} className="flex flex-col gap-8">
          {/* Main Battle Card */}
          <div className="heist-card relative overflow-hidden">
            <div className="scanline-overlay"></div>
            <div className="blueprint-grid absolute inset-0 opacity-10"></div>
            
            <div className="heist-card-header flex flex-col md:flex-row items-center justify-between gap-4 py-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-600 rounded-sm pulse-red">
                  <Swords size={32} className="text-white" />
                </div>
                <div>
                  <h1 className="heist-font text-white text-4xl tracking-widest uppercase m-0 leading-none">LIVE <span className="text-red-600">INFILTRATION</span></h1>
                  <span className="heist-subtitle-mono">NEURAL LINK ACTIVE — SECTOR {currentActiveMatch.domain}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="heist-mono text-[10px] text-gray-600 mb-1 tracking-widest">OPERATION CLOCK</span>
                <MatchTimer startTime={currentActiveMatch.startTime} />
              </div>
            </div>

            <div className="heist-card-content p-12">
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-12 mb-16">
                {/* Team A */}
                <div className="heist-card p-8 bg-black/40 border-white/5 flex flex-col items-center group">
                  <div className="heist-mono text-[9px] text-gray-600 tracking-widest uppercase mb-6">
                    {currentActiveMatch.teamA.id === myTeam?.id ? 'FRIENDLY UNIT' : 'HOSTILE UNIT'}
                  </div>
                  <div className="heist-font text-4xl tracking-widest text-white mb-6 text-center group-hover:text-red-500 transition-colors">
                    {currentActiveMatch.teamA.name}
                  </div>
                  <div className="heist-font text-5xl text-gray-400">
                    {currentActiveMatch.teamA.tokens} <span className="text-sm text-gray-700">TKN</span>
                  </div>
                </div>
                
                {/* VS Divider */}
                <div className="flex flex-col items-center justify-center relative">
                  <div className="heist-font text-8xl text-red-600 font-bold opacity-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none">VERSUS</div>
                  <div className="heist-font text-7xl text-red-600 relative z-10 drop-shadow-[0_0_15px_rgba(211,47,47,0.5)]">VS</div>
                </div>
                
                {/* Team B */}
                <div className="heist-card p-8 bg-black/40 border-white/5 flex flex-col items-center group">
                  <div className="heist-mono text-[9px] text-gray-600 tracking-widest uppercase mb-6">
                    {currentActiveMatch.teamB.id === myTeam?.id ? 'FRIENDLY UNIT' : 'HOSTILE UNIT'}
                  </div>
                  <div className="heist-font text-4xl tracking-widest text-white mb-6 text-center group-hover:text-red-500 transition-colors">
                    {currentActiveMatch.teamB.name}
                  </div>
                  <div className="heist-font text-5xl text-gray-400">
                    {currentActiveMatch.teamB.tokens} <span className="text-sm text-gray-700">TKN</span>
                  </div>
                </div>
              </div>

              {/* Status Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="heist-card p-8 bg-red-950/10 border-red-600/20 flex flex-col items-center justify-center text-center">
                    <Zap className="text-red-600 mb-4 animate-pulse" size={24} />
                    <span className="heist-font text-2xl text-white tracking-widest uppercase mb-2">ENGAGEMENT DOMAIN: {currentActiveMatch.domain}</span>
                    <span className="heist-mono text-red-500 text-[10px] tracking-[0.3em] uppercase">
                      {currentActiveMatch.isWager ? 'CRITICAL STAKES — ALL OR NOTHING' : 'STANDARD PROTOCOL ±1 TKN'}
                    </span>
                 </div>
                 
                 <div className="heist-card p-8 bg-black/60 border-white/5 flex flex-col items-center justify-center text-center">
                    <ShieldAlert className="text-gray-600 mb-4" size={24} />
                    <span className="heist-mono text-gray-400 text-[10px] tracking-[0.2em] uppercase leading-relaxed">
                      AWAITING OVERSEER DECLARATION AT THE TERMINAL. DO NOT DISCONNECT NEURAL LINK.
                    </span>
                 </div>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (myTeam?.status === 'matched') {
      return (
        <motion.div variants={itemVariants} className="heist-card relative overflow-hidden min-h-[450px] flex flex-col items-center justify-center p-16 text-center">
           <div className="scanline-overlay"></div>
           <div className="blueprint-grid absolute inset-0 opacity-10"></div>
           <div className="absolute inset-0 bg-red-600/5 animate-pulse"></div>
           
           <Swords size={100} className="text-red-600 mb-10 relative z-10" />
           <h2 className="heist-font text-white text-7xl mb-6 tracking-tighter uppercase relative z-10">TARGET <span className="text-red-600">LOCKED</span></h2>
           <p className="heist-mono text-gray-400 text-xs tracking-[0.3em] uppercase max-w-xl mx-auto mb-12 relative z-10 leading-loose">
             THE PROFESSOR IS ASSIGNING SECTOR PARAMETERS. PREPARE FOR DEPLOYMENT.
           </p>
           <div className="heist-badge badge-red px-12 py-3 animate-pulse relative z-10 text-sm">
             AWAITING BRIEFING...
           </div>
        </motion.div>
      );
    }

    if (isInQueue) {
      return (
        <motion.div variants={itemVariants} className="heist-card relative overflow-hidden min-h-[450px] flex flex-col items-center justify-center p-16 text-center">
          <div className="scanline-overlay"></div>
          <div className="blueprint-grid absolute inset-0 opacity-10"></div>
          
          <div className="relative mb-12">
            <div className="absolute -inset-16 border border-red-600/20 rounded-full animate-[spin_12s_linear_infinite]"></div>
            <div className="absolute -inset-10 border border-red-600/10 rounded-full animate-[spin_18s_linear_infinite_reverse]"></div>
            <Search size={100} className="text-red-600 opacity-80" />
          </div>
          
          <h2 className="heist-font text-white text-6xl mb-4 tracking-widest uppercase">SCANNING <span className="text-red-600">GRID</span></h2>
          <p className="heist-mono text-gray-400 text-xs tracking-[0.3em] uppercase max-w-lg mx-auto">
            HUNTING FOR ELIGIBLE NEURAL SIGNATURES...
          </p>
        </motion.div>
      );
    }

    return (
      <motion.div variants={itemVariants} className="heist-card min-h-[450px] flex flex-col items-center justify-center p-16 text-center grayscale opacity-60">
        <div className="scanline-overlay"></div>
        <Target size={100} className="text-gray-700 mb-10" />
        <h2 className="heist-font text-gray-500 text-6xl mb-6 tracking-widest uppercase">NO ACTIVE OP</h2>
        <p className="heist-mono text-gray-600 text-xs tracking-[0.3em] uppercase max-w-xl mx-auto leading-loose">
          PROCEED TO THE ARENA STATION. SYSTEM WILL AUTOMATICALLY INITIATE MATCHMAKING UPON DETECTION OF ELIGIBLE TARGETS.
        </p>
      </motion.div>
    );
  };

  return (
    <motion.div className="text-white relative flex flex-col gap-8 h-full pb-12" variants={containerVariants} initial="hidden" animate="visible">
      <div className="heist-header-tactical mb-4">
        <div>
          <h1 className="heist-title-main">COMBAT <span className="heist-title-accent">FEED</span></h1>
          <span className="heist-subtitle-mono">REAL-TIME INFILTRATION TELEMETRY</span>
        </div>
        <div className="heist-badge badge-teal">SYSTEM ENCRYPTED</div>
      </div>
      {renderContent()}
    </motion.div>
  );
};

export default BattleScreen;
