import React from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Users, Clock, Trophy, Activity, Bell, Timer, Lock } from 'lucide-react';

const LobbyScreen = () => {
  const { teams, myTeam, gameState, matchHistory, notifications, sortedLeaderboard, tokenHistory, gameTimer } = useGameState();

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <motion.div className="flex-col gap-6" variants={containerVariants} initial="hidden" animate="visible">

      {/* Phase + Game Status */}
      <motion.div variants={itemVariants} className="flex justify-between items-center" style={{ padding: '0.75rem 1.5rem', background: gameState.phase === 'phase2' ? 'rgba(255,95,143,0.05)' : 'rgba(0,255,136,0.05)', border: `1px solid ${gameState.phase === 'phase2' ? 'rgba(255,95,143,0.3)' : 'rgba(0,255,136,0.2)'}`, borderRadius: 'var(--radius-lg)' }}>
        <div className="flex items-center gap-3">
          {gameState.isGameActive && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-survival)', animation: 'pulseGlow 2s infinite' }} />}
          <span className={gameState.phase === 'phase2' ? 'text-magenta' : 'text-survival'} style={{ fontWeight: 600 }}>
            {gameState.isGameActive ? (gameState.phase === 'phase2' ? '🔥 Phase 2 — WAGER MODE LIVE' : '📋 Phase 1 — STANDARD MODE') : gameState.isPaused ? '⏸ GAME PAUSED' : 'AWAITING START'}
          </span>
        </div>
        {(gameState.isGameActive || gameState.isPaused) && (
          <div className="game-timer flex items-center gap-2"><Clock size={14} /> {gameTimer}</div>
        )}
      </motion.div>

      {/* Locked State */}
      {!gameState.isGameActive && !gameState.isPaused && (
        <motion.div variants={itemVariants} className="card text-center" style={{ padding: '3rem 2rem' }}>
          <Lock size={48} className="text-warning" style={{ marginBottom: '1rem', opacity: 0.6 }} />
          <h2 className="font-heading" style={{ color: 'var(--accent-warning)', marginBottom: '0.5rem', fontSize: '2rem' }}>AWAITING GAME START</h2>
          <p className="text-muted font-mono" style={{ fontSize: '0.9rem' }}>The Admin will start the tournament soon. Stand by.</p>
        </motion.div>
      )}

      {/* My Team Card */}
      {myTeam && (
        <motion.div variants={itemVariants} className="card" style={{ padding: '1.25rem 1.5rem', border: '1px solid var(--border-glow)' }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="font-heading" style={{ width: '42px', height: '42px', background: 'var(--accent-survival)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: '1.2rem', borderRadius: 'var(--radius-md)' }}>
                {myTeam.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-heading" style={{ fontWeight: 700, fontSize: '1.5rem' }}>{myTeam.name}</div>
                <div className="text-muted font-mono" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  Leader: {myTeam.leader} · Status: <span className={`status-${myTeam.status}`}>{myTeam.status}</span>
                  {myTeam.status === 'timeout' && ' ⏰'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="badge badge-survival" style={{ fontSize: '1rem', padding: '0.4rem 1rem' }}>{myTeam.tokens} TKN</div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* LEFT COLUMN */}
        <div className="flex-col gap-6">
          {/* Leaderboard */}
          <motion.div variants={itemVariants} className="card" style={{ padding: '1.5rem' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
              <Trophy className="text-warning" />
              <h2 className="font-heading text-xl m-0 tracking-wider">LEADERBOARD</h2>
            </div>
            <div className="flex-col gap-2">
              {sortedLeaderboard.map((team, idx) => (
                <div key={team.id} className="flex justify-between items-center" style={{ padding: '0.75rem 1rem', background: team.status === 'eliminated' ? 'rgba(255, 59, 59, 0.05)' : team.status === 'timeout' ? 'rgba(255, 201, 77, 0.05)' : idx === 0 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: team.status === 'eliminated' ? '1px solid rgba(255, 59, 59, 0.2)' : idx === 0 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid transparent' }}>
                  <div className="flex items-center gap-3">
                    <div className="font-heading" style={{ fontSize: '1.5rem', color: team.status === 'eliminated' ? 'var(--accent-danger)' : idx === 0 ? 'var(--accent-warning)' : 'var(--text-muted)', width: '2rem' }}>
                      {team.status === 'eliminated' ? '☠' : `#${idx + 1}`}
                    </div>
                    <div>
                      <div className="font-heading" style={{ fontSize: '1.2rem', color: team.status === 'eliminated' ? 'var(--accent-danger)' : 'var(--text-main)', textDecoration: team.status === 'eliminated' ? 'line-through' : 'none' }}>
                        {team.name} {myTeam && team.id === myTeam.id && <span className="text-survival" style={{ fontSize: '0.8rem' }}>(YOU)</span>}
                      </div>
                      <div className="text-muted font-mono" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Leader: {team.leader}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge badge-${team.status === 'idle' ? 'survival' : team.status === 'fighting' ? 'danger' : team.status === 'eliminated' ? 'danger' : team.status === 'timeout' ? 'warning' : 'cyan'}`}>{team.status}</span>
                    <span className={`badge ${team.status === 'eliminated' ? 'badge-danger' : 'badge-survival'}`}>{team.tokens} TKN</span>
                  </div>
                </div>
              ))}
              {sortedLeaderboard.length === 0 && <p className="text-muted font-mono">NO TEAMS YET.</p>}
            </div>
          </motion.div>

          {/* Match History */}
          <motion.div variants={itemVariants} className="card" style={{ padding: '1.5rem' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
              <Activity className="text-magenta" />
              <h2 className="font-heading text-xl m-0 tracking-wider">MATCH HISTORY</h2>
            </div>
            <div className="flex-col gap-2">
              {matchHistory.length === 0 && <p className="text-muted font-mono">NO MATCHES YET.</p>}
              {matchHistory.map(m => (
                <div key={m.id} className="flex justify-between items-center" style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div className="font-heading" style={{ fontSize: '1.1rem' }}>
                      <span className="text-success">{m.winner}</span> beat <span className="text-danger">{m.loser}</span>
                    </div>
                    <div className="text-muted font-mono" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>{m.domain} · {m.timestamp}</div>
                  </div>
                  <span className={`badge ${m.isWager ? 'badge-magenta' : 'badge-warning'}`}>{m.isWager ? 'WAGER' : '±1'}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex-col gap-6">
          {/* Team Directory */}
          <motion.div variants={itemVariants} className="card" style={{ padding: '1.5rem' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
              <Users className="text-survival" />
              <h2 className="font-heading text-xl m-0 tracking-wider">TEAMS ({teams.length})</h2>
            </div>
            <div className="flex-col gap-2">
              {teams.map(t => (
                <div key={t.id} style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex justify-between items-center">
                    <span className="font-heading" style={{ fontSize: '1.1rem', color: t.status === 'eliminated' ? 'var(--accent-danger)' : 'inherit', textDecoration: t.status === 'eliminated' ? 'line-through' : 'none' }}>{t.name}</span>
                    <span className={`badge badge-${t.status === 'eliminated' ? 'danger' : t.status === 'idle' ? 'success' : t.status === 'fighting' ? 'danger' : t.status === 'timeout' ? 'warning' : 'cyan'}`}>{t.status}</span>
                  </div>
                  <div className="text-muted font-mono" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>{t.members} MEMBERS · {t.tokens} TKN</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Live Feed */}
          <motion.div variants={itemVariants} className="card" style={{ padding: '1.5rem' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
              <Bell className="text-warning" />
              <h2 className="font-heading text-xl m-0 tracking-wider">LIVE FEED</h2>
            </div>
            <div className="flex-col gap-3 font-mono" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {notifications.length === 0 && <p className="text-muted">NO ACTIVITY.</p>}
              {notifications.map(n => (
                <div key={n.id} style={{ paddingLeft: '0.75rem', borderLeft: '2px solid var(--accent-survival)' }}>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>{n.message}</div>
                  <div className="text-muted" style={{ fontSize: '0.65rem' }}>{n.time}</div>
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
