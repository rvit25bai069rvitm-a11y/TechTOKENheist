import React, { useState, useEffect } from 'react';
import { useGameState } from '../hooks/useGameState';
import { Lock, Swords } from 'lucide-react';
import './FinaleOverlay.css';

const TOTAL_ROUNDS = 5;

/* ─── Particle layers ─── */
const FireParticles = () => (
  <div className="finale-particles">
    {Array.from({ length: 20 }, (_, i) => (
      <div key={i} className="finale-particle" />
    ))}
  </div>
);

const ConfettiParticles = () => (
  <div className="victory-confetti">
    {Array.from({ length: 20 }, (_, i) => (
      <div key={i} className="victory-confetti-piece" />
    ))}
  </div>
);

/* ─── Victory Screen ─── */
const VictoryScreen = ({ winnerName, scoreA, scoreB, teamAName, teamBName }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  return (
    <div className="finale-victory-overlay" style={{ opacity: show ? 1 : 0, transition: 'opacity 1s ease-in' }}>
      <div className="victory-bg-burst" />
      <div className="victory-flare" />
      <div className="victory-rings" />
      <ConfettiParticles />
      <div className="finale-scanlines" />

      <div className="victory-title">VICTORY</div>
      <div className="victory-winner-name">{winnerName}</div>
      <div className="victory-score">
        <span className="victory-score-a">{scoreA}</span>
        <span className="victory-score-sep">—</span>
        <span className="victory-score-b">{scoreB}</span>
      </div>
      <div style={{ display: 'flex', gap: '4rem', position: 'relative', zIndex: 10, marginTop: '1rem' }}>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', color: 'rgba(211,47,47,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          {teamAName}
        </span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem', color: 'rgba(77,182,172,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          {teamBName}
        </span>
      </div>
      <div className="victory-subtitle">THE ULTIMATE CHAMPION HAS BEEN CROWNED</div>
    </div>
  );
};

/* ─── Round Tracker Dots ─── */
const RoundTracker = ({ finaleResults, currentRound }) => {
  return (
    <div className="finale-rounds">
      {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
        const result = finaleResults?.[i];
        let className = 'finale-round-dot';
        if (result === 'a') className += ' won-a';
        else if (result === 'b') className += ' won-b';
        else if (i === currentRound) className += ' active';
        return (
          <React.Fragment key={i}>
            {i > 0 && <div className="finale-round-separator" />}
            <div className={className} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

const FinaleRoundTimer = ({ startTime, isPaused = false, pausedAt = null, className = '' }) => {
  const [display, setDisplay] = useState('0:00');

  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const effectiveNow = isPaused && pausedAt ? pausedAt : Date.now();
      const ms = Math.max(0, effectiveNow - startTime);
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setDisplay(`${mins}:${String(secs).padStart(2, '0')}`);
    };
    tick();
    if (isPaused) return undefined;
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startTime, isPaused, pausedAt]);

  if (!startTime) return null;
  return <span className={`finale-timer-value ${className}`}>{display}</span>;
};

/* ─── Main Finale Overlay ─── */
const FinaleOverlay = () => {
  const { gameState, user, myTeam } = useGameState();
  const finaleState = gameState.finaleState;

  // Don't show if no finale active or admin view
  if (!finaleState || !finaleState.isFinaleActive || user?.role === 'admin') return null;

  const {
    teamAName, teamBName,
    finaleResults, currentRound, currentDomain,
    finaleWinner, winsA, winsB,
  } = finaleState;

  const resolvedWinsA = winsA || 0;
  const resolvedWinsB = winsB || 0;
  const isFinalist = myTeam?.status === 'finalist';
  const pendingDomain = finaleState?.pendingDomain;
  const roundStartedAt = finaleState?.roundStartedAt;
  const bannerText = isFinalist
    ? 'FINALISTS LOCKED IN - SETTLE THE SCORE'
    : 'FINALE IN PROGRESS - SPECTATOR MODE';
  const roleClass = isFinalist ? 'finale-finalist-mode' : 'finale-spectator-mode';
  const lockTitle = isFinalist ? 'FINALIST MODE' : 'SPECTATOR LOCKDOWN';
  const lockSubtitle = isFinalist
    ? 'You are cleared for the finale fight.'
    : 'Battle feed locked. Witness the finalists in the arena.';
  const lockTag = isFinalist ? 'FIGHT FOR THE CROWN' : 'WITNESS THE ARENA SHOWDOWN';

  // Victory screen
  if (finaleWinner) {
    const winnerName = finaleWinner === 'a' ? teamAName : teamBName;
    return (
      <VictoryScreen
        winnerName={winnerName}
        scoreA={resolvedWinsA}
        scoreB={resolvedWinsB}
        teamAName={teamAName}
        teamBName={teamBName}
      />
    );
  }

  const shakeClass = currentRound > 0 ? 'finale-shake' : '';

  return (
    <div className={`finale-overlay ${shakeClass} ${roleClass}`}>
      <div className="finale-bg-grid" />
      <div className="finale-bg-radial" />
      <div className="finale-scanlines" />
      <FireParticles />

      {/* Spectating banner for non-finalist teams */}
      <div className="finale-locked-banner">
        ⚠ {bannerText}
      </div>

      <div className="finale-battle-container">
        {/* Title */}
        <div className="finale-title-container">
          <div className="finale-title">FINALE</div>
          <div className="finale-subtitle">THE ULTIMATE SHOWDOWN</div>
        </div>

        <div className={`finale-lock-panel ${isFinalist ? 'is-finalist' : 'is-spectator'}`}>
          <div className="finale-lock-rings">
            <div className="finale-lock-ring" />
            <div className="finale-lock-ring finale-lock-ring-two" />
          </div>
          {isFinalist ? (
            <Swords className="finale-lock-icon" size={64} />
          ) : (
            <Lock className="finale-lock-icon" size={64} />
          )}
          <div className="finale-lock-title">{lockTitle}</div>
          <div className="finale-lock-subtitle">{lockSubtitle}</div>
          <div className="finale-lock-tag">{lockTag}</div>
        </div>

        <div className="finale-duel">
          <div className="finale-duel-team finale-duel-team-a">
            <div className="finale-duel-label">FINALIST A</div>
            <div className="finale-duel-name">{teamAName}</div>
          </div>
          <div className="finale-duel-clash">
            <div className="finale-duel-ring" />
            <div className="finale-duel-ring finale-duel-ring-inner" />
            <div className="finale-duel-burst" />
            <div className="finale-duel-sparks">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className="finale-duel-spark" />
              ))}
            </div>
            <div className="finale-duel-vs">VS</div>
          </div>
          <div className="finale-duel-team finale-duel-team-b">
            <div className="finale-duel-label">FINALIST B</div>
            <div className="finale-duel-name">{teamBName}</div>
          </div>
        </div>

        {/* Matchup */}
        <div className="finale-matchup">
          <div className="finale-team-card">
            <div className="finale-team-name">{teamAName}</div>
            <div className="finale-team-wins">{resolvedWinsA}</div>
            <div className="finale-team-wins-label">ROUND WINS</div>
          </div>

          <div className="finale-vs">
            <div className="finale-vs-ring" />
            <div className="finale-vs-ring-inner" />
            <div className="finale-vs-text">VS</div>
          </div>

          <div className="finale-team-card">
            <div className="finale-team-name">{teamBName}</div>
            <div className="finale-team-wins">{resolvedWinsB}</div>
            <div className="finale-team-wins-label">ROUND WINS</div>
          </div>
        </div>

        {/* Domain */}
        {currentDomain && (
          <div className="finale-domain-card finale-domain-live">
            <div className="finale-domain-label">LIVE DOMAIN - ROUND {(currentRound || 0) + 1} OF {TOTAL_ROUNDS}</div>
            <div className="finale-domain-name">{currentDomain}</div>
            {roundStartedAt && (
              <div className="finale-domain-timer">
                <span className="finale-domain-timer-label">ROUND TIMER</span>
                <FinaleRoundTimer startTime={roundStartedAt} isPaused={gameState.isPaused} pausedAt={gameState.pausedAt} className="finale-domain-timer-value" />
              </div>
            )}
          </div>
        )}

        {!currentDomain && pendingDomain && (
          <div className="finale-domain-card finale-domain-pending">
            <div className="finale-domain-label">DOMAIN LOCKED - AWAITING INITIATE</div>
            <div className="finale-domain-name">{pendingDomain}</div>
          </div>
        )}

        {!currentDomain && !pendingDomain && (
          <div className="finale-domain-card" style={{ borderColor: 'rgba(253, 216, 53, 0.3)', background: 'rgba(253, 216, 53, 0.03)' }}>
            <div className="finale-domain-label">AWAITING DOMAIN ASSIGNMENT</div>
            <div className="finale-domain-name" style={{ color: '#fdd835' }}>STAND BY...</div>
          </div>
        )}

        {/* Round Tracker */}
        <RoundTracker finaleResults={finaleResults || []} currentRound={currentRound || 0} />

        {/* Info Strip */}
        <div className="finale-info-strip">
          <div className="finale-info-item">
            <span className="finale-info-label">ROUND</span>
            <span className="finale-info-value">{(currentRound || 0) + 1} / {TOTAL_ROUNDS}</span>
          </div>
          <div className="finale-info-item">
            <span className="finale-info-label">FORMAT</span>
            <span className="finale-info-value">BO{TOTAL_ROUNDS}</span>
          </div>
          <div className="finale-info-item">
            <span className="finale-info-label">MODE</span>
            <span className="finale-info-value" style={{ color: '#ff1744' }}>DEATHMATCH</span>
          </div>
          {roundStartedAt && (
            <div className="finale-info-item">
              <span className="finale-info-label">TIMER</span>
              <FinaleRoundTimer startTime={roundStartedAt} isPaused={gameState.isPaused} pausedAt={gameState.pausedAt} className="finale-info-value" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinaleOverlay;
