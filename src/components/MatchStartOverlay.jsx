import { useState, useEffect, useRef } from 'react';
import { useGameState } from '../hooks/useGameState';
import './MatchStartOverlay.css';

const START_DURATION_MS = 10000;
const END_DURATION_MS = 12000;

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed);
      return Number.isNaN(asNumber) ? null : asNumber;
    }
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const MatchStartOverlay = () => {
  const { gameState } = useGameState();
  const [active, setActive] = useState(false);
  const [timer, setTimer] = useState(10);
  const [phase, setPhase] = useState(0); // 0: None, 1: Domain, 2: Void
  const [isTearing, setIsTearing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [timerPulse, setTimerPulse] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const audioPlayedRef = useRef(false);
  const flashPlayedRef = useRef(false);
  const timerPulseRef = useRef(false);
  const pendingTimeoutsRef = useRef([]);

  // Use a local ref to track if we've already played this start
  const startedAtRef = useRef(null);

  const clearPendingTimeouts = () => {
    pendingTimeoutsRef.current.forEach((id) => clearTimeout(id));
    pendingTimeoutsRef.current = [];
  };

  const scheduleTimeout = (callback, delay) => {
    const id = setTimeout(callback, delay);
    pendingTimeoutsRef.current.push(id);
  };

  useEffect(() => {
    if (gameState.isGameActive && gameState.gameStartedAt && !isFinished) {
      const startTime = toMillis(gameState.gameStartedAt);
      if (!startTime) return undefined;

      const now = Date.now();
      const elapsed = now - startTime;

      // Only trigger if the game started recently (within the intro timeline)
      // This prevents the cinematic from playing if someone refreshes mid-game
      // but allows it to sync if they are already on the page.
      if (elapsed < END_DURATION_MS && startedAtRef.current !== startTime) {
        setActive(true);
        setIsTearing(false);
        setIsFinished(false);
        setShowAnnouncement(true);
        setShowSubtitles(false);
        setPhase(0);
        startedAtRef.current = startTime;
        audioPlayedRef.current = false;
        flashPlayedRef.current = false;
        timerPulseRef.current = false;
        setTimerPulse(false);

        if (timerRef.current) cancelAnimationFrame(timerRef.current);
        clearPendingTimeouts();

        const tick = () => {
          const currentTime = Date.now();
          const currentElapsed = currentTime - startTime;
          const remaining = Math.max(0, (START_DURATION_MS - currentElapsed) / 1000);

          setTimer(remaining);
          setShowAnnouncement(currentElapsed < 4000);

          // Audio + flash at 6s mark (4000ms elapsed)
          if (currentElapsed >= 4000 && !audioPlayedRef.current) {
            audioPlayedRef.current = true;
            audioRef.current?.play().catch(e => console.log("Audio play blocked", e));
          }
          if (currentElapsed >= 4000 && !flashPlayedRef.current) {
            flashPlayedRef.current = true;
            setFlashActive(true);
            scheduleTimeout(() => setFlashActive(false), 800);
          }

          if (currentElapsed >= 6000 && !timerPulseRef.current) {
            timerPulseRef.current = true;
            setTimerPulse(true);
          }

          if (currentElapsed >= 7000) {
            setShowSubtitles(true);
          }

          // Phase 1 Subtitles at 3s mark (7000ms elapsed)
          if (currentElapsed >= 7000 && currentElapsed < 8500) {
            setPhase(1);
          }
          // Phase 2 Subtitles at 1.5s mark (8500ms elapsed)
          else if (currentElapsed >= 8500 && currentElapsed < START_DURATION_MS) {
            setPhase(2);
          } else {
            setPhase(0);
          }

          // Tearing at 10s mark (10000ms elapsed)
          if (currentElapsed >= START_DURATION_MS) {
            setIsTearing(true);
            setTimer(0);

            // End the component after tearing animation (2s)
            if (currentElapsed >= END_DURATION_MS) {
              setIsFinished(true);
              setActive(false);
              setShowSubtitles(false);
              setShowAnnouncement(false);
              cancelAnimationFrame(timerRef.current);
              return;
            }
          }

          timerRef.current = requestAnimationFrame(tick);
        };

        timerRef.current = requestAnimationFrame(tick);
      }
    } else if (!gameState.isGameActive) {
      // Reset if game is stopped so it can play again next time
      startedAtRef.current = null;
      audioPlayedRef.current = false;
      flashPlayedRef.current = false;
      timerPulseRef.current = false;
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      clearPendingTimeouts();
      const resetTimeoutId = setTimeout(() => {
        setIsFinished(false);
        setActive(false);
        setIsTearing(false);
        setShowAnnouncement(true);
        setShowSubtitles(false);
        setPhase(0);
        setTimerPulse(false);
      }, 0);

      return () => {
        clearTimeout(resetTimeoutId);
        if (timerRef.current) cancelAnimationFrame(timerRef.current);
        clearPendingTimeouts();
      };
    }

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      clearPendingTimeouts();
    };
  }, [gameState.isGameActive, gameState.gameStartedAt, isFinished]);

  if (!active || isFinished) return null;

  return (
    <div className={`match-start-overlay ${isTearing ? 'tearing' : ''} ${phase === 2 ? 'void-mode' : ''} ${timerPulse ? 'pulse-timer' : ''}`}>
      <audio ref={audioRef} src={new URL('../../assets/anant.mp3', import.meta.url).href} />

      <div className="background-container" />
      <div className="overlay" />
      <div className={`flash-screen ${flashActive ? 'flash-animation' : ''}`} />

      <div className="tear-wrapper">
        <div className="tear-part tear-left" />
        <div className="tear-part tear-right" />

        <div className="content-container">
          <div className={`announcement ${showAnnouncement ? 'visible' : ''}`}>
            GAME STARTING IN {Math.ceil(timer)}
          </div>

          <div className="timer-container">
            <div className={`timer-value ${phase >= 1 ? 'glitch' : ''}`}>{Math.ceil(timer)}</div>
          </div>

          <div className={`subtitles ${showSubtitles ? 'visible' : ''}`}>
            {phase === 1 && (
              <div className="subtitle-phase phase-1" key="phase-1">
                <div className="hindi">क्षेत्र विस्तार</div>
                <div className="english">KSHETRA VISTĀRAM</div>
                <div className="translation">DOMAIN EXPANSION</div>
              </div>
            )}
            {phase === 2 && (
              <div className="subtitle-phase phase-2" key="phase-2">
                <div className="hindi">अनन्त शून्यता</div>
                <div className="english">ANANTA ŚŪNYATĀ</div>
                <div className="translation">INFINITE VOID</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchStartOverlay;
