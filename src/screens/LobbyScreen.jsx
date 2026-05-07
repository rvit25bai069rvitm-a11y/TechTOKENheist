import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Users, Clock, Trophy, Activity, Bell, Lock, Zap, VenetianMask, Skull } from 'lucide-react';
import { getProfileAvatar, getProfileLabel } from '../data/profileAvatars';
import './AdminScreen.css'; // Re-use the heist styles

const LobbyScreen = () => {
  const { teams, myTeam, gameState, matchHistory, notifications, sortedLeaderboard, gameTimer } = useGameState();

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  const myAvatar = myTeam?.avatarSrc || getProfileAvatar(myTeam?.name);
  const rivalAvatar = teams.find((team) => team.id !== myTeam?.id)?.avatarSrc || getProfileAvatar('berlin');

  return (
    <motion.div className="min-h-screen heist-bg p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden flex flex-col gap-6 pb-20" variants={containerVariants} initial="hidden" animate="visible">
      {/* Background Graffiti */}
      <div className="graffiti text-8xl top-20 right-10 transform rotate-12 opacity-5">LA RESISTENCIA</div>
      <div className="graffiti text-6xl bottom-40 left-10 transform -rotate-12 opacity-5">BERLIN</div>

      {/* Phase + Game Status */}
      <motion.div variants={itemVariants} className="panel-container border-2 border-heist-teal p-4 flex flex-col md:flex-row justify-between items-center gap-4 relative z-10 shadow-lg">
        <div className="flex items-center gap-4 w-full">
          {gameState.isGameActive ? <Zap className={gameState.phase === 'phase2' ? 'text-heist-red animate-pulse' : 'text-heist-teal animate-pulse'} size={32} /> : <Lock className="text-gray-500" size={32} />}
          <div className="flex flex-col">
            <div className={`heist-font text-3xl tracking-wider ${gameState.phase === 'phase2' ? 'text-heist-red' : 'text-heist-teal'}`}>
              {gameState.isGameActive ? (gameState.phase === 'phase2' ? '🔥 PHASE 2 — WAGER MODE LIVE' : '📋 PHASE 1 — STANDARD MODE') : gameState.isPaused ? '⏸ OPERATION PAUSED' : 'AWAITING BRIEFING'}
            </div>
            <div className="heist-mono text-sm text-gray-400 mt-1 uppercase tracking-widest">
              Operation Status Monitor
            </div>
          </div>
        </div>
        {(gameState.isGameActive || gameState.isPaused) && (
          <div className="flex items-center gap-2 border-2 border-heist-yellow px-4 py-2 bg-black bg-opacity-70 shadow-inner flex-shrink-0">
            <Clock className="text-heist-yellow" size={20} />
            <span className="heist-font text-heist-yellow tracking-widest text-xl">{gameTimer}</span>
          </div>
        )}
      </motion.div>

      {/* Locked State */}
      {!gameState.isGameActive && !gameState.isPaused && (
        <motion.div variants={itemVariants} className="panel-container border-2 border-gray-600 p-12 flex flex-col items-center text-center relative z-10">
          <Lock size={64} className="text-gray-500 mb-6" />
          <h2 className="heist-font text-heist-yellow text-4xl mb-2 tracking-widest">AWAITING GAME START</h2>
          <p className="heist-mono text-gray-400 text-lg">The Professor will initiate the tournament soon. Stand by.</p>
        </motion.div>
      )}

      {/* My Team Card */}
      {myTeam && (
        <motion.div variants={itemVariants} className="panel-container border-l-8 border-heist-red p-6 relative z-10 overflow-hidden shadow-2xl">
          {/* Faint blueprint bg inside card */}
          <div className="absolute inset-0 bg-blueprint opacity-50 pointer-events-none"></div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-heist-red shadow-[0_0_15px_rgba(211,47,47,0.5)]">
                  <img src={myAvatar} alt={myTeam ? getProfileLabel(myTeam.name) : 'Player Avatar'} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-heist-red text-white p-1 rounded-full border-2 border-black">
                  <VenetianMask size={16} />
                </div>
              </div>
              <div>
                <div className="heist-font text-5xl tracking-widest text-white drop-shadow-md">{myTeam.name}</div>
                <div className="heist-mono text-gray-400 text-sm mt-1 flex flex-wrap gap-3">
                  <span>LEADER: <span className="text-white">{myTeam.leader}</span></span>
                  <span>STATUS: <span className={`px-2 py-0.5 text-black ${myTeam.status === 'idle' ? 'bg-heist-teal' : myTeam.status === 'fighting' ? 'bg-heist-red text-white' : myTeam.status === 'eliminated' ? 'bg-gray-600' : 'bg-heist-yellow'}`}>{myTeam.status.toUpperCase()}</span></span>
                  {myTeam.status === 'timeout' && <span className="text-heist-yellow animate-pulse">⏰ TIMEOUT ACTIVE</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="heist-mono text-gray-400 text-xs mb-1 tracking-widest">CURRENT LOOT</div>
              <div className="heist-font text-5xl text-heist-yellow drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] border-b-4 border-heist-yellow pb-1 px-2">
                {myTeam.tokens} <span className="text-2xl">TKN</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* LEFT COLUMN - Wider */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Leaderboard */}
          <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-6 bg-blueprint">
            <div className="flex items-center gap-3 border-b-2 border-gray-700 pb-3 mb-4">
              <Trophy className="text-heist-yellow" size={28} />
              <h2 className="heist-font text-3xl text-white m-0 tracking-wider">LEADERBOARD</h2>
            </div>
            <div className="flex flex-col gap-3">
              {sortedLeaderboard.map((team, idx) => (
                <div key={team.id} className={`flex justify-between items-center p-4 border ${team.status === 'eliminated' ? 'border-heist-red bg-red-900 bg-opacity-20' : idx === 0 ? 'border-heist-yellow bg-yellow-900 bg-opacity-10' : 'border-gray-700 bg-black bg-opacity-60'} transition-colors`}>
                  <div className="flex items-center gap-4">
                    <div className={`heist-font text-3xl w-10 text-center ${team.status === 'eliminated' ? 'text-heist-red' : idx === 0 ? 'text-heist-yellow' : 'text-gray-500'}`}>
                      {team.status === 'eliminated' ? <Skull size={24} className="mx-auto" /> : `#${idx + 1}`}
                    </div>
                    <div className="flex flex-col">
                      <div className={`heist-font text-2xl tracking-wider ${team.status === 'eliminated' ? 'text-heist-red line-through' : 'text-white'}`}>
                        {team.name} {myTeam && team.id === myTeam.id && <span className="text-heist-teal text-lg ml-2">(YOU)</span>}
                      </div>
                      <div className="heist-mono text-xs text-gray-500 uppercase">Leader: {team.leader}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`heist-mono text-[10px] px-2 py-1 border ${team.status === 'idle' ? 'border-heist-teal text-heist-teal' : team.status === 'fighting' ? 'border-heist-red bg-heist-red text-white' : team.status === 'eliminated' ? 'border-heist-red text-heist-red' : 'border-heist-yellow text-heist-yellow'}`}>
                      {team.status.toUpperCase()}
                    </span>
                    <span className={`heist-font text-2xl w-20 text-right ${team.status === 'eliminated' ? 'text-heist-red' : 'text-heist-yellow'}`}>
                      {team.tokens} TKN
                    </span>
                  </div>
                </div>
              ))}
              {sortedLeaderboard.length === 0 && <p className="heist-mono text-gray-500">NO CREWS RECRUITED YET.</p>}
            </div>
          </motion.div>

          {/* Match History */}
          <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-6">
            <div className="flex items-center gap-3 border-b-2 border-gray-700 pb-3 mb-4">
              <Activity className="text-heist-red" size={28} />
              <h2 className="heist-font text-3xl text-white m-0 tracking-wider">OPERATION LOG</h2>
            </div>
            <div className="flex flex-col gap-2">
              {matchHistory.length === 0 && <p className="heist-mono text-gray-500">NO OPERATIONS CONCLUDED.</p>}
              {matchHistory.map(m => (
                <div key={m.id} className="flex justify-between items-center p-3 border-l-4 border-gray-600 bg-black bg-opacity-50 hover:border-heist-red transition-colors">
                  <div className="flex flex-col">
                    <div className="heist-font text-xl tracking-wider">
                      <span className="text-white">{m.winner}</span> <span className="text-gray-600 mx-2">DEF.</span> <span className="text-heist-red line-through">{m.loser}</span>
                    </div>
                    <div className="heist-mono text-xs text-gray-500 uppercase">Domain: <span className="text-heist-teal">{m.domain}</span> · {m.timestamp}</div>
                  </div>
                  <span className={`heist-mono text-xs px-2 py-1 border ${m.isWager ? 'border-heist-red text-heist-red bg-red-900 bg-opacity-20' : 'border-gray-500 text-gray-400'}`}>
                    {m.isWager ? 'WAGER' : '±1'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Team Directory with Player 2 avatar as decoration */}
          <motion.div variants={itemVariants} className="panel-container border-2 border-[#333] p-6 relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-10 pointer-events-none w-24 h-24">
              <img src={rivalAvatar} alt="Rival Avatar" className="w-full h-full object-cover rounded-full grayscale" />
            </div>
            <div className="flex items-center gap-3 border-b-2 border-gray-700 pb-3 mb-4 relative z-10">
              <Users className="text-heist-teal" size={24} />
              <h2 className="heist-font text-2xl text-white m-0 tracking-wider">ALL CREWS ({teams.length})</h2>
            </div>
            <div className="flex flex-col gap-3 relative z-10">
              {teams.map(t => (
                <div key={t.id} className="p-3 border border-gray-800 bg-black bg-opacity-70 hover:border-gray-600 transition-colors flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700 bg-black flex-shrink-0">
                    <img src={t.avatarSrc || getProfileAvatar(t.name)} alt={getProfileLabel(t.name)} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`heist-font text-xl tracking-wider ${t.status === 'eliminated' ? 'text-heist-red line-through' : 'text-white'}`}>{t.name}</span>
                    <span className={`w-2 h-2 rounded-full ${t.status === 'eliminated' ? 'bg-heist-red' : t.status === 'idle' ? 'bg-heist-teal' : t.status === 'fighting' ? 'bg-heist-red animate-pulse' : 'bg-heist-yellow'}`}></span>
                  </div>
                  <div className="heist-mono text-[10px] text-gray-500 uppercase flex justify-between">
                    <span>{t.members} MEMBERS</span>
                    <span className="text-heist-yellow">{t.tokens} TKN</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Live Feed */}
          <motion.div variants={itemVariants} className="panel-container border-2 border-heist-yellow p-6">
            <div className="flex items-center gap-3 border-b-2 border-heist-yellow pb-3 mb-4">
              <Bell className="text-heist-yellow" size={24} />
              <h2 className="heist-font text-2xl text-heist-yellow m-0 tracking-wider">LIVE INTEL</h2>
            </div>
            <div className="flex flex-col gap-4 font-mono max-h-[400px] overflow-y-auto pr-2">
              {notifications.length === 0 && <p className="heist-mono text-gray-500">NO ACTIVITY DETECTED.</p>}
              {notifications.map(n => (
                <div key={n.id} className="border-l-2 border-heist-yellow pl-3">
                  <div className="heist-mono text-xs uppercase text-gray-300 leading-relaxed">{n.message}</div>
                  <div className="heist-mono text-[10px] text-gray-600 mt-1">{n.time}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default LobbyScreen;
