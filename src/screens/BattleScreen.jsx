import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { Target, ShieldAlert, Lock, Swords, Clock, Timer } from 'lucide-react';

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
  return <span className="stopwatch">{display}</span>;
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
  return <div className="game-timer" style={{ fontSize: '2.5rem', display: 'inline-block' }}>{display}</div>;
};

const BattleScreen = () => {
  const { myTeam, currentActiveMatch, gameState, isInQueue } = useGameState();

  if (!gameState.isGameActive && !gameState.isPaused) {
    return (
      <div className="card text-center" style={{ padding: '4rem 2rem' }}>
        <Lock size={48} className="text-warning" style={{ marginBottom: '1rem', opacity: 0.6 }} />
        <h2 className="font-heading" style={{ color: 'var(--accent-warning)', marginBottom: '0.5rem', fontSize: '2rem' }}>BATTLE LOCKED</h2>
        <p className="text-muted font-mono">The game has not started yet.</p>
      </div>
    );
  }

  if (gameState.isPaused) {
    return (
      <div className="card text-center" style={{ padding: '4rem 2rem', border: '1px solid var(--accent-warning)' }}>
        <Lock size={48} className="text-warning" style={{ marginBottom: '1rem', opacity: 0.6 }} />
        <h2 className="font-heading" style={{ color: 'var(--accent-warning)', marginBottom: '0.5rem', fontSize: '2rem' }}>GAME PAUSED</h2>
        <p className="text-muted font-mono">All actions frozen.</p>
      </div>
    );
  }

  // Timeout state
  if (myTeam?.status === 'timeout' && myTeam.timeoutUntil) {
    return (
      <motion.div className="card text-center" style={{ padding: '4rem 2rem', border: '1px solid var(--accent-warning)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Timer size={64} className="text-warning" style={{ margin: '0 auto 1.5rem', animation: 'pulseGlow 2s infinite' }} />
        <h2 className="font-heading text-warning" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>TIMEOUT</h2>
        <p className="text-muted font-mono" style={{ marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
          You hit 0 tokens. Waiting for timeout to expire. You'll be automatically reset to 1 token.
        </p>
        <TimeoutCountdown until={myTeam.timeoutUntil} />
        <div className="text-muted font-mono" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>TIME REMAINING</div>
      </motion.div>
    );
  }

  // Eliminated state
  if (myTeam?.status === 'eliminated') {
    return (
      <motion.div className="card text-center" style={{ padding: '4rem 2rem', border: '1px solid var(--accent-danger)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>☠️</div>
        <h2 className="font-heading text-danger" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>ELIMINATED</h2>
        <p className="text-muted font-mono">You have been permanently eliminated from the tournament.</p>
      </motion.div>
    );
  }

  return (
    <div className="flex-col gap-6">
      {/* Active Fight */}
      {currentActiveMatch ? (
        <motion.div className="card" style={{ padding: '2.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(255,0,255,0.08) 0%, transparent 60%)', animation: 'spin 10s linear infinite', zIndex: 0 }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="badge badge-danger" style={{ marginBottom: '1rem', fontSize: '1rem', padding: '0.5rem 1rem' }}>⚔️ MATCH IN PROGRESS</div>
            <div className={`badge ${currentActiveMatch.isWager ? 'badge-magenta' : 'badge-survival'}`} style={{ marginBottom: '2rem', display: 'inline-block', marginLeft: '0.5rem', fontSize: '1rem', padding: '0.5rem 1rem' }}>{currentActiveMatch.domain}</div>

            <div className="flex justify-center items-center gap-8" style={{ marginBottom: '2rem' }}>
              <div>
                <div className="font-heading" style={{ fontSize: '2rem', letterSpacing: '2px' }}>
                  {currentActiveMatch.teamA.id === myTeam?.id ? 'YOUR TEAM' : currentActiveMatch.teamA.name}
                </div>
                <div style={{ marginTop: '0.5rem' }}><div className="badge badge-survival">{currentActiveMatch.teamA.tokens} TKN</div></div>
              </div>
              <div className="font-heading" style={{ fontSize: '4rem', color: 'var(--accent-danger)', textShadow: '0 0 20px rgba(255,51,102,0.5)' }}>VS</div>
              <div>
                <div className="font-heading" style={{ fontSize: '2rem', letterSpacing: '2px' }}>
                  {currentActiveMatch.teamB.id === myTeam?.id ? 'YOUR TEAM' : currentActiveMatch.teamB.name}
                </div>
                <div style={{ marginTop: '0.5rem' }}><div className="badge badge-survival">{currentActiveMatch.teamB.tokens} TKN</div></div>
              </div>
            </div>

            <div style={{ padding: '1rem 2rem', background: 'rgba(0,0,0,0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glow)', display: 'inline-block' }}>
              <div className="text-muted font-mono" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>TIME ELAPSED</div>
              <MatchTimer startTime={currentActiveMatch.startTime} />
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <div className="text-warning flex items-center justify-center gap-2 font-mono" style={{ fontWeight: 700 }}>
                <ShieldAlert size={18} /> {currentActiveMatch.isWager ? 'WAGER MODE — HIGH STAKES' : 'STAKES: ±1 TKN'}
              </div>
              <div className="text-muted font-mono" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>ADMIN WILL DECLARE WINNER</div>
            </div>
          </div>
        </motion.div>
      ) : myTeam?.status === 'matched' ? (
        <motion.div className="card text-center" style={{ padding: '3rem 2rem' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Swords size={56} className="text-survival" style={{ marginBottom: '1rem', animation: 'float 3s ease-in-out infinite' }} />
          <h2 className="font-heading text-survival" style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>MATCH FOUND!</h2>
          <p className="text-muted font-mono" style={{ maxWidth: '400px', margin: '0 auto', fontSize: '0.9rem' }}>
            Admin will spin the domain wheel and start your match shortly.
          </p>
          <div className="badge badge-cyan" style={{ marginTop: '1.5rem', fontSize: '1rem' }}>AWAITING ADMIN...</div>
        </motion.div>
      ) : isInQueue ? (
        <motion.div className="card text-center" style={{ padding: '3rem 2rem' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Swords size={56} className="text-cyan" style={{ marginBottom: '1rem', animation: 'pulseGlow 2s infinite' }} />
          <h2 className="font-heading text-cyan" style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>IN QUEUE</h2>
          <p className="text-muted font-mono" style={{ maxWidth: '400px', margin: '0 auto' }}>
            Searching for an opponent in your token range...
          </p>
        </motion.div>
      ) : (
        <motion.div className="card text-center" style={{ padding: '4rem 2rem', minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Target size={56} className="text-muted" style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <h2 className="text-muted font-heading" style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>NO ACTIVE MATCH</h2>
          <p className="text-muted font-mono" style={{ maxWidth: '400px', margin: '0 auto' }}>
            Go to the Arena. Eligible teams are queued automatically for matchmaking.
          </p>
        </motion.div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default BattleScreen;
