import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Target, ShieldAlert, Lock, Swords, Clock, Timer, VenetianMask } from 'lucide-react';
import './AdminScreen.css';

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
  return <span className="heist-font text-heist-yellow tracking-widest text-4xl">{display}</span>;
};

const TimeoutCountdown = ({ until }) => {
  const [display, setDisplay] = useState('');
  useEffect(() => {
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
  return <div className="heist-font text-white tracking-widest" style={{ fontSize: '5rem', display: 'inline-block' }}>{display}</div>;
};

const BattleScreen = () => {
  const { myTeam, currentActiveMatch, gameState, isInQueue } = useGameState();

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  const renderContent = () => {
    if (!gameState.isGameActive && !gameState.isPaused) {
      return (
        <motion.div variants={itemVariants} className="panel-container border-2 border-gray-600 p-16 text-center relative z-10 bg-black bg-opacity-80">
          <Lock size={64} className="text-gray-500 mb-6 mx-auto" />
          <h2 className="heist-font text-heist-yellow text-5xl mb-2 tracking-widest">BATTLE LOCKED</h2>
          <p className="heist-mono text-gray-400 text-lg uppercase">The operation has not commenced.</p>
        </motion.div>
      );
    }

    if (gameState.isPaused) {
      return (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-yellow p-16 text-center relative z-10 bg-yellow-900 bg-opacity-20">
          <Lock size={64} className="text-heist-yellow mb-6 mx-auto opacity-70" />
          <h2 className="heist-font text-heist-yellow text-5xl mb-2 tracking-widest">OPERATION PAUSED</h2>
          <p className="heist-mono text-gray-400 text-lg uppercase">All actions frozen by The Professor.</p>
        </motion.div>
      );
    }

    // Timeout state
    if (myTeam?.status === 'timeout' && myTeam.timeoutUntil) {
      return (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-yellow p-16 text-center relative z-10 bg-black">
          <Timer size={80} className="text-heist-yellow mb-6 mx-auto animate-pulse" />
          <h2 className="heist-font text-heist-yellow text-5xl mb-4 tracking-widest">TIMEOUT</h2>
          <p className="heist-mono text-gray-400 text-lg uppercase max-w-lg mx-auto mb-8">
            You hit 0 tokens. Waiting for timeout to expire. You will be automatically reset to 1 token.
          </p>
          <TimeoutCountdown until={myTeam.timeoutUntil} />
          <div className="heist-mono text-gray-500 text-sm uppercase mt-4">TIME REMAINING</div>
        </motion.div>
      );
    }

    // Eliminated state
    if (myTeam?.status === 'eliminated') {
      return (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-red p-16 text-center relative z-10 bg-black">
          <VenetianMask size={80} className="text-heist-red mb-6 mx-auto opacity-80" />
          <h2 className="heist-font text-heist-red text-6xl mb-4 tracking-widest">ELIMINATED</h2>
          <p className="heist-mono text-gray-400 text-xl uppercase">You have been permanently eliminated from the tournament.</p>
        </motion.div>
      );
    }

    // Active Fight
    if (currentActiveMatch) {
      return (
        <motion.div variants={itemVariants} className="panel-container border-4 border-heist-red p-8 text-center relative z-10 overflow-hidden shadow-[0_0_40px_rgba(211,47,47,0.3)] bg-black">
          {/* Radar Sweep Background */}
          <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2" style={{ background: 'conic-gradient(from 0deg, transparent 0 340deg, rgba(211,47,47,0.4) 360deg)', animation: 'radar-spin 4s linear infinite', zIndex: 0 }}></div>
          <div className="absolute inset-0 bg-blueprint opacity-20 z-0 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="inline-block px-4 py-2 bg-heist-red text-white heist-font tracking-widest text-2xl mb-6 shadow-md border border-white">
              ⚔️ INFILTRATION IN PROGRESS
            </div>
            
            <div className="mb-10">
              <span className={`px-4 py-2 heist-font tracking-widest text-2xl ${currentActiveMatch.isWager ? 'bg-heist-red text-white' : 'border-2 border-heist-teal text-heist-teal bg-black'}`}>
                {currentActiveMatch.domain}
              </span>
            </div>

            <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-16 mb-12">
              <div className="flex flex-col items-center">
                <div className="heist-font text-5xl tracking-widest text-white drop-shadow-md mb-2">
                  {currentActiveMatch.teamA.id === myTeam?.id ? 'YOUR CREW' : currentActiveMatch.teamA.name}
                </div>
                <div className="px-3 py-1 border-b-2 border-heist-yellow heist-font text-heist-yellow text-3xl">
                  {currentActiveMatch.teamA.tokens} TKN
                </div>
              </div>
              
              <div className="heist-font text-7xl text-heist-red drop-shadow-[0_0_15px_rgba(211,47,47,0.8)] mx-4 my-4 md:my-0">
                VS
              </div>
              
              <div className="flex flex-col items-center">
                <div className="heist-font text-5xl tracking-widest text-white drop-shadow-md mb-2">
                  {currentActiveMatch.teamB.id === myTeam?.id ? 'YOUR CREW' : currentActiveMatch.teamB.name}
                </div>
                <div className="px-3 py-1 border-b-2 border-heist-yellow heist-font text-heist-yellow text-3xl">
                  {currentActiveMatch.teamB.tokens} TKN
                </div>
              </div>
            </div>

            <div className="inline-block p-6 bg-black bg-opacity-80 border-2 border-gray-700 shadow-inner mb-8 min-w-[250px]">
              <div className="heist-mono text-gray-500 text-sm uppercase mb-2 tracking-widest">ELAPSED DURATION</div>
              <MatchTimer startTime={currentActiveMatch.startTime} />
            </div>

            <div className="mt-4 border-t border-gray-800 pt-6 max-w-lg mx-auto">
              <div className="text-heist-yellow flex items-center justify-center gap-3 heist-mono text-lg uppercase mb-2">
                <ShieldAlert size={24} /> {currentActiveMatch.isWager ? 'WAGER MODE — HIGH STAKES' : 'STAKES: ±1 TKN'}
              </div>
              <div className="heist-mono text-gray-500 text-sm uppercase">AWAITING ADMIN DECLARATION OF VICTORY</div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (myTeam?.status === 'matched') {
      return (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-teal p-16 text-center relative z-10 bg-black">
          <Swords size={80} className="text-heist-teal mb-6 mx-auto animate-bounce" />
          <h2 className="heist-font text-heist-teal text-6xl mb-4 tracking-widest">TARGET ACQUIRED!</h2>
          <p className="heist-mono text-gray-400 text-xl uppercase max-w-lg mx-auto mb-8">
            The Professor is assigning the target domain. Prepare for infiltration.
          </p>
          <div className="px-6 py-2 bg-heist-teal text-black heist-font text-2xl tracking-widest inline-block shadow-md">
            AWAITING BRIEFING...
          </div>
        </motion.div>
      );
    }

    if (isInQueue) {
      return (
        <motion.div variants={itemVariants} className="panel-container border-2 border-heist-teal p-16 text-center relative z-10 bg-black overflow-hidden">
          {/* Scanning line effect */}
          <div className="absolute inset-0 bg-heist-teal opacity-5 pointer-events-none animate-pulse"></div>
          
          <Search size={80} className="text-heist-teal mb-6 mx-auto animate-spin-slow" />
          <h2 className="heist-font text-heist-teal text-5xl mb-4 tracking-widest">SCANNING NETWORK</h2>
          <p className="heist-mono text-gray-400 text-xl uppercase max-w-lg mx-auto">
            Hunting for an eligible target...
          </p>
        </motion.div>
      );
    }

    return (
      <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-16 text-center relative z-10 bg-black flex flex-col items-center justify-center min-h-[400px]">
        <Target size={80} className="text-gray-600 mb-6 mx-auto opacity-50" />
        <h2 className="heist-font text-gray-400 text-5xl mb-4 tracking-widest">NO ACTIVE OPERATION</h2>
        <p className="heist-mono text-gray-500 text-lg uppercase max-w-lg mx-auto">
          Proceed to the Arena. Eligible crews are queued automatically for matchmaking.
        </p>
      </motion.div>
    );
  };

  return (
    <motion.div className="min-h-screen heist-bg p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden flex flex-col gap-6 pb-20" variants={containerVariants} initial="hidden" animate="visible">
      {/* Background Graffiti */}
      <div className="graffiti text-8xl top-40 right-20 transform -rotate-12 opacity-5 pointer-events-none">BELLA CIAO</div>
      <div className="graffiti text-6xl bottom-20 left-10 transform rotate-6 opacity-5 pointer-events-none">TOKYO</div>
      
      {renderContent()}

      <style>{`
        @keyframes radar-spin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </motion.div>
  );
};

export default BattleScreen;
