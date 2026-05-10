import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Users, Trophy, Activity, Bell, Crown, Clock3, AlertCircle } from 'lucide-react';
import { getProfileAvatar, getProfileLabel } from '../data/profileAvatars';

const LobbyScreen = () => {
  const { teams, myTeam, gameState, matchHistory, notifications, sortedLeaderboard } = useGameState();

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  const teamName = myTeam?.name || 'GUEST';
  
  const teamMatchHistory = useMemo(() => {
    if (!teamName || teamName === 'GUEST') return [];
    return matchHistory.filter(h => h.winner === teamName || h.loser === teamName);
  }, [matchHistory, teamName]);

  const recentMatches = [...teamMatchHistory].slice(-4).reverse();
  const recentNotifications = [...(notifications || [])].slice(-4).reverse();

  return (
    <motion.div className="text-white relative flex flex-col gap-8 h-full pb-12" variants={containerVariants} initial="hidden" animate="visible">

      {/* COMMAND CENTER HEADER */}
      <motion.div variants={itemVariants} className="heist-card p-8 md:p-12 relative overflow-hidden group">
        <div className="scanline-overlay opacity-5"></div>
        <div className="blueprint-grid absolute inset-0 opacity-10"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-3 h-3 rounded-full ${gameState.isGameActive ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gray-600'}`}></div>
              <span className="heist-mono text-red-500 text-xs tracking-[0.4em] uppercase font-bold">
                {gameState.isGameActive ? `PHASE ${gameState.phase === 'phase2' ? '02' : '01'} // LINK ESTABLISHED` : 'SYSTEM STANDBY'}
              </span>
            </div>
            
            <h1 className="heist-title-main text-5xl md:text-8xl mb-6">
              {gameState.isGameActive ? (
                <>COMMAND <span className="heist-title-accent">ACTIVE</span></>
              ) : (
                <>AWAITING <span className="heist-title-accent">DEBRIEF</span></>
              )}
            </h1>
            
            <div className="max-w-2xl border-l-2 border-red-600 pl-6 py-2">
              <p className="heist-mono text-gray-400 text-xs md:text-sm tracking-widest leading-loose uppercase">
                {gameState.isGameActive 
                  ? 'The vault is vulnerable. All tactical units are deployed to their designated sectors. Monitor real-time telemetry and await direct orders from the Professor.' 
                  : 'Pre-operational verification in progress. Ensure all neural links are stable and crew members are accounted for. The heist will begin upon final administrative override.'}
              </p>
            </div>
          </div>
          
          <div className="hidden lg:block">
            <div className="relative w-48 h-48 opacity-20 group-hover:opacity-40 transition-opacity duration-700">
               <img src="/icons/closedbank.png" alt="Bank" className="w-full h-full object-contain filter grayscale invert" />
               <div className="absolute inset-0 bg-red-600/20 mix-blend-overlay"></div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow">
        
        {/* TACTICAL RANKING (Left Panel) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 heist-card flex flex-col h-fit">
          <div className="heist-header-tactical border-b border-white/5 p-6 mb-0">
            <div className="flex items-center gap-3">
              <Trophy className="text-red-500" size={20} />
              <h2 className="heist-font text-white text-3xl tracking-widest m-0 uppercase">RANKING</h2>
            </div>
            <div className="heist-badge badge-red">LIVE DATA</div>
          </div>
          
          <div className="flex flex-col p-4 gap-3 max-h-[600px] overflow-y-auto custom-scrollbar">
            {sortedLeaderboard.map((team, idx) => {
              const isMe = myTeam?.id === team.id;
              return (
                <div key={team.id} className={`relative flex items-center justify-between p-4 transition-all group ${isMe ? 'bg-red-600/20 border border-red-600' : 'bg-white/2 border border-white/5 hover:border-red-600/30'}`}>
                  {isMe && <div className="absolute left-0 top-0 h-full w-1 bg-red-600 shadow-[0_0_15px_rgba(211,47,47,0.8)]"></div>}
                  <div className="flex items-center gap-5 min-w-0">
                    <span className={`heist-font text-4xl w-10 text-center ${idx === 0 ? 'text-red-500' : idx === 1 ? 'text-white' : 'text-gray-700'} ${isMe ? 'text-white' : ''}`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0">
                      <img src={team.avatarSrc} alt={team.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="heist-font text-2xl tracking-widest truncate text-white uppercase group-hover:text-red-500 transition-colors">
                        {team.name}
                      </span>
                      <span className="heist-mono text-[9px] uppercase tracking-[0.2em] mt-1 text-gray-500">
                        OP: {team.leader}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`heist-font text-3xl tracking-widest leading-none ${isMe ? 'text-white' : 'text-red-600'}`}>{team.tokens}</span>
                    <span className="heist-mono text-[8px] uppercase tracking-widest text-gray-600">TOKENS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* OPERATIONS BOARD (Right Panel) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* DEPLOYED UNITS */}
          <motion.div variants={itemVariants} className="heist-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Users className="text-red-500" size={20} />
                <h2 className="heist-font text-white text-3xl tracking-widest m-0 uppercase">OPERATIONAL UNITS</h2>
              </div>
              <span className="heist-mono text-[10px] text-gray-600 uppercase tracking-[0.3em]">{teams.length} DETECTED</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
              {teams.map(team => (
                <div key={team.id} className="bg-white/2 border border-white/5 p-4 hover:border-red-600/40 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-red-600/5 to-transparent"></div>
                  <span className="heist-font text-xl text-white tracking-widest truncate block mb-2 group-hover:text-red-500 transition-colors uppercase">{team.name}</span>
                  <div className="flex items-center justify-between mt-auto">
                    <div className={`w-1.5 h-1.5 rounded-full ${team.status === 'fighting' ? 'bg-red-500 animate-pulse' : team.status === 'eliminated' ? 'bg-gray-800' : 'bg-teal-500'}`}></div>
                    <span className="heist-mono text-[8px] text-gray-600 uppercase tracking-widest">{team.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* LOWER INTEL GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-grow">
            
            {/* OPERATION LOGS */}
            <motion.div variants={itemVariants} className="heist-card flex flex-col">
              <div className="heist-header-tactical border-b border-white/5 p-5 mb-0">
                <div className="flex items-center gap-2">
                  <Activity className="text-red-500" size={18} />
                  <h2 className="heist-font text-white text-2xl tracking-widest m-0 uppercase">TELEMETRY LOGS</h2>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[400px] custom-scrollbar">
                {recentMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-20">
                    <AlertCircle size={32} className="mb-4" />
                    <span className="heist-mono text-[10px] uppercase tracking-[0.4em]">No operational data.</span>
                  </div>
                ) : (
                  recentMatches.map((entry, index) => (
                    <div key={`${entry.id || index}`} className="bg-black/40 border-l border-red-600 p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="heist-mono text-[9px] text-red-500 uppercase tracking-[0.2em] font-bold">{entry.domain || 'SECTOR UNKNOWN'}</span>
                        <span className="heist-mono text-[9px] text-gray-700">{entry.timestamp || entry.created_at || ''}</span>
                      </div>
                      <div className="heist-mono text-xs tracking-widest uppercase leading-relaxed">
                        {entry.winner === teamName ? (
                          <span className="text-teal-500 font-bold">MISSION SUCCESS: NEUTRALIZED {entry.loser}</span>
                        ) : (
                          <span className="text-red-600 font-bold">MISSION FAILURE: NEUTRALIZED BY {entry.winner}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* LIVE INTEL FEED */}
            <motion.div variants={itemVariants} className="heist-card flex flex-col">
              <div className="heist-header-tactical border-b border-white/5 p-5 mb-0">
                <div className="flex items-center gap-2">
                  <Bell className="text-red-500" size={18} />
                  <h2 className="heist-font text-white text-2xl tracking-widest m-0 uppercase">INTEL FEED</h2>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[400px] custom-scrollbar">
                {recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 opacity-20">
                    <AlertCircle size={32} className="mb-4" />
                    <span className="heist-mono text-[10px] uppercase tracking-[0.4em]">Scanning frequencies...</span>
                  </div>
                ) : (
                  recentNotifications.map((entry, index) => (
                    <div key={`${entry.id || index}`} className="flex items-start gap-4 p-4 border border-white/5 bg-white/2 hover:bg-white/5 transition-all">
                      <Clock3 size={14} className="text-red-600 mt-1 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <p className="heist-mono text-[11px] text-gray-400 uppercase tracking-widest leading-loose m-0">{entry.message}</p>
                        <span className="heist-mono text-[8px] text-gray-700 mt-3 font-bold tracking-widest">{entry.time || ''}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LobbyScreen;
