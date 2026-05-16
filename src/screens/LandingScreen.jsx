import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingScreen.css';
import rvitmImg from '../assets/rvitm.png';
import tokenImg from '../../assets/token.png';
import tokyolImg from '../../assets/icons/tokyol.png';
import riolImg from '../../assets/icons/riol.png';
import berlinlImg from '../../assets/icons/berlinl.png';
import songMp3 from '../assets/song.mp3';
import { motion } from 'framer-motion';
import gdgLogo from '../../assets/gdg.png';

const TOKEN_BURST = [
  { id: 'alpha', x: -31, y: -24, size: 64, delay: 0.1, duration: 6.8, drift: -26, spin: -240, scale: 0.92 },
  { id: 'bravo', x: 28, y: -19, size: 48, delay: 0.45, duration: 6.2, drift: 22, spin: 280, scale: 0.82 },
  { id: 'charlie', x: -21, y: 12, size: 42, delay: 0.75, duration: 5.8, drift: -18, spin: 210, scale: 0.78 },
  { id: 'delta', x: 23, y: 16, size: 70, delay: 0.25, duration: 7.2, drift: 30, spin: 320, scale: 0.96 },
  { id: 'echo', x: -4, y: -31, size: 36, delay: 0.95, duration: 5.4, drift: 16, spin: -180, scale: 0.72 },
];

const RAIN_TOKENS = Array.from({ length: 22 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;

  return {
    id: index,
    left: `${(index * 9 + (index % 3) * 4) % 100}%`,
    size: 34 + (index % 5) * 11,
    delay: index * 0.26,
    duration: 5.1 + (index % 6) * 0.58,
    drift: side * (58 + index * 4),
    spin: 300 + index * 34,
    faceSpin: 1.05 + (index % 4) * 0.18,
    sway: 22 + (index % 6) * 7,
    scale: (0.76 + (index % 5) * 0.07).toFixed(2),
    blur: index % 6 === 0 ? 1.2 : index % 5 === 0 ? 0.55 : 0,
  };
});

const finaleMotion = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.58, margin: '-8% 0px -14% 0px' },
  transition: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
};

const LandingScreen = () => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [showScrollHint, setShowScrollHint] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add('landing-route');
    return () => {
      document.documentElement.classList.remove('landing-route', 'landing-scroll-mode');
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('landing-scroll-mode', started);
    return () => {
      document.documentElement.classList.remove('landing-scroll-mode');
    };
  }, [started]);

  const handleStart = () => {
    setStarted(true);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (audioRef.current) {
      audioRef.current.volume = 0.08;
      audioRef.current.play().catch(() => console.log('Audio play blocked'));

      let vol = 0.08;
      const fadeAudio = setInterval(() => {
        vol += 0.01;
        if (vol >= 0.2) {
          clearInterval(fadeAudio);
          vol = 0.2;
        }
        if (audioRef.current) audioRef.current.volume = vol;
      }, 300);
    }
  };

  const handlePreludeKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStart();
    }
  };

  const handleEnterSystem = () => {
    if (audioRef.current) {
      let vol = audioRef.current.volume;
      const fadeOut = setInterval(() => {
        vol -= 0.02;
        if (vol <= 0) {
          clearInterval(fadeOut);
          vol = 0;
          audioRef.current.pause();
        }
        if (audioRef.current) audioRef.current.volume = Math.max(0, vol);
      }, 50);
    }

    navigate('/login');
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e) => {
      if (
        e.target.tagName.toLowerCase() === 'a' ||
        e.target.tagName.toLowerCase() === 'button' ||
        e.target.closest('button') ||
        e.target.closest('a') ||
        e.target.classList.contains('prelude-overlay')
      ) {
        document.body.classList.add('landing-is-hovering');
      } else {
        document.body.classList.remove('landing-is-hovering');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      document.body.classList.remove('landing-is-hovering');
    };
  }, []);

  useEffect(() => {
    if (!started) return;

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-active');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: [0.18, 0.45],
      rootMargin: '-8% 0px -14% 0px',
    });

    // Give React a tick to render the dw-cards
    setTimeout(() => {
      document.querySelectorAll('.dw-card').forEach(el => observer.observe(el));
    }, 100);

    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const timer = setTimeout(() => {
      if (window.scrollY < 50) {
        setShowScrollHint(true);
      }
    }, 3400); // Wait for typewriter to mostly finish

    return () => clearTimeout(timer);
  }, [started]);

  // Compute derived visual properties from scroll position
  // 100vh = window.innerHeight. Assuming sections are at least 100vh.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Background slowly becomes visible around section 1 (100vh) to section 2 (200vh)
  const bgOpacity = started ? Math.min(1, Math.max(0, (scrollY - vh * 0.5) / vh)) : 0;
  // Darken everything heavily near the end (Section 9)
  const pitchBlackOpacity = Math.min(1, Math.max(0, (scrollY - vh * 7.5) / vh));

  // Phase 2 red shift fades in across the phase section instead of snapping.
  const phase2Progress = Math.min(1, Math.max(0, (scrollY - vh * 5.55) / (vh * 0.95)));
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const isMobileViewport = viewportWidth <= 768;
  const safeMouseX = mousePos.x >= 0 ? mousePos.x : viewportWidth / 2;
  const safeMouseY = mousePos.y >= 0 ? mousePos.y : vh / 2;
  const rainDriftX = ((safeMouseX / viewportWidth) - 0.5) * 220;
  const rainDriftY = ((safeMouseY / vh) - 0.5) * 90;
  const rainSpeed = started ? Math.max(0.35, 1 - (scrollY / (vh * 5)) * 0.65) : 1;
  
  const tokyoRevealRadius = isMobileViewport ? 260 : 360;
  const tokyoLightRadius = isMobileViewport ? 300 : 390;
  const tokyoRevealMask = `radial-gradient(${tokyoRevealRadius}px circle at ${safeMouseX}px ${safeMouseY}px, black 0%, rgba(0, 0, 0, 0.82) 24%, rgba(0, 0, 0, 0.36) 54%, transparent 100%)`;
  const tokyoCursorGlow = `radial-gradient(${tokyoLightRadius}px circle at ${safeMouseX}px ${safeMouseY}px, rgba(255, 190, 82, 0.16), rgba(255, 111, 0, 0.09) 32%, rgba(150, 17, 10, 0.045) 56%, transparent 78%)`;

  return (
    <div
      className={`landing-container ${started ? 'is-started' : ''}`}
      style={{
        '--rain-drift-x': `${rainDriftX}px`,
        '--rain-drift-y': `${rainDriftY}px`,
        '--rain-drift-x-mid': `${rainDriftX * 0.55}px`,
        '--rain-drift-y-mid': `${rainDriftY * 0.4}px`,
      }}
    >
      <audio ref={audioRef} src={songMp3} loop />

      {/* 0. PRELUDE — SILENCE */}
      {!started && (
        <div
          className="prelude-overlay"
          onClick={handleStart}
          onKeyDown={handlePreludeKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Begin Tech Token Heist intro"
        >
          <p className="prelude-text">you are invited</p>
        </div>
      )}

      {/* FIXED VAULT BACKGROUND (rvitm.png) */}
      <motion.div
        className="vault-bg"
        style={{
          opacity: bgOpacity,
          '--phase-red-progress': phase2Progress,
        }}
        transition={{
          opacity: { duration: 0.8, ease: "easeOut" }
        }}
      >
        <div
          className="vault-bg-inner" 
          style={{ 
            backgroundImage: `url(${rvitmImg})`,
          }} 
        />
        <div
          className="vault-bg-inner vault-bg-inner--red"
          style={{
            backgroundImage: `url(${rvitmImg})`,
          }}
          aria-hidden="true"
        />
      </motion.div>

      {/* Environmental Effects Overlays */}
      <div className="vault-fog" style={{ opacity: bgOpacity * 0.6 }} />
      <div className="vault-light-rays" style={{ opacity: bgOpacity * 0.4 }} />

      {/* MAIN SCROLL CONTENT */}
      {started && (
        <div className="scroll-content">

          {/* 1. AUDIO AWAKENS + TYPE INIT */}
          <section className="dw-card sec-init is-active">
            <div className="typewriter-box">
              <p className="init-type-1">El mayor robo comienza ahora...</p>
              <div className="init-glitch-replace">
                <p className="init-type-sub">El sistema ya est&aacute; en marcha.</p>
              </div>
            </div>
            <div className="scroll-pulse-indicator" style={{ opacity: showScrollHint && scrollY < 50 ? 1 : 0 }}>
              <p className="scroll-text">Scroll to open the dossier</p>
              <div className="arrow"></div>
            </div>
          </section>

          {/* 2. VAULT EMERGENCE */}
          <section className="dw-card sec-emergence">
            <div className="text-left-block">
              <p className="cinematic-line line-1 dw-card__text">This is not a game.</p>
              <p className="cinematic-line line-2 mt-20 dw-card__text">This is a controlled system.</p>
            </div>
          </section>

          {/* 3. SYSTEM REVEAL (OVERLAY UI) */}
          <section className="dw-card sec-system-reveal">
            <div className="grid-overlay"></div>
            <div className="coords-overlay">SYS.COORD: [40.4168° N, 3.7038° W]</div>
            <div className="nodes-container">
              <div className="sys-node n1"></div>
              <div className="sys-node n2"></div>
              <div className="sys-node n3"></div>
              <div className="sys-node n4"></div>
            </div>

            <div className="text-right-block">
              <p className="cinematic-line line-1 dw-card__text">No inputs.</p>
              <p className="cinematic-line line-2 mt-4 dw-card__text">No decisions.</p>
              <p className="cinematic-line line-3 mt-4 dw-card__text">No control.</p>
              <p className="cinematic-line line-4 mt-16 text-red glow-text dw-card__text">Only outcomes.</p>
            </div>
          </section>

          {/* 4. MATCHMAKING VISUALIZATION */}
          <section className="dw-card sec-matchmaking">
            <div className="animated-system-lines">
              {/* Abstract connecting lines */}
              <div className="connecting-line l1"></div>
              <div className="connecting-line l2"></div>
              <div className="connecting-line l3"></div>
            </div>
          </section>


          {/* 6. TOKEN SYSTEM */}
          <section className="dw-card sec-tokens">
            <div className="token-burst" aria-hidden="true">
              {TOKEN_BURST.map((token) => (
                <span
                  key={token.id}
                  className="token-burst__coin"
                  style={{
                    '--coin-x': `${token.x}vw`,
                    '--coin-y': `${token.y}vh`,
                    '--coin-size': `${token.size}px`,
                    '--coin-delay': `${token.delay}s`,
                    '--coin-duration': `${token.duration}s`,
                    '--coin-drift': `${token.drift}px`,
                    '--coin-spin': `${token.spin}deg`,
                    '--coin-spin-mid': `${token.spin * 0.45}deg`,
                    '--coin-spin-late': `${token.spin * 0.82}deg`,
                    '--coin-scale': `${token.scale}`,
                    '--coin-entry-scale': `${token.scale * 0.7}`,
                    '--coin-exit-scale': `${token.scale * 0.78}`,
                  }}
                >
                  <img src={tokenImg} alt="" />
                </span>
              ))}
            </div>
            <div className="center-block">
              <p className="cinematic-line line-1 text-gold token-title">Tokens define your position.</p>
              <div className="token-rule-set mt-20">
                <p className="cinematic-line line-2 token-rule dw-card__text">
                  <span>Gain them.</span>
                  <span className="token-change token-change--gain">+1</span>
                </p>
                <p className="cinematic-line line-3 token-rule dw-card__text">
                  <span>Lose them.</span>
                  <span className="token-change token-change--loss">-2</span>
                </p>
                <p className="cinematic-line line-4 token-rule text-red dw-card__text">
                  <span>Or disappear.</span>
                  <span className="token-change token-change--danger">-5</span>
                </p>
              </div>
            </div>
          </section>

          {/* 7. PHASE TRANSITION */}
          <section className="dw-card sec-phase">
            <div className="phase-1-block">
              <h2 className="phase-title text-blue dw-card__display--single">Phase 1</h2>
              <p className="cinematic-line p1-l1 mt-4 dw-card__text">Controlled.</p>
              <p className="cinematic-line p1-l2 mt-2 dw-card__text">Balanced.</p>
              <p className="cinematic-line p1-l3 mt-2 dw-card__text">Predictable.</p>
            </div>
            <div className="phase-2-block">
              <h2 className="phase-title text-red glitch dw-card__display--single" data-text="Phase 2">Phase 2</h2>
              <p className="cinematic-line p2-l1 mt-4 dw-card__text">Constraints removed.</p>
              <p className="cinematic-line p2-l2 mt-2 dw-card__text">Risk amplified.</p>
              <p className="cinematic-line p2-l3 mt-12 text-red glow-text dw-card__text">Loss is permanent.</p>
            </div>
          </section>

          {/* 8. PARTICLE / MONEY RAIN */}
          <section className="dw-card sec-particles">
            <div className="token-rain" aria-hidden="true">
              {RAIN_TOKENS.map((token) => (
                <span
                  key={token.id}
                  className="token-rain__coin"
                  style={{
                    left: token.left,
                    width: `${token.size}px`,
                    height: `${token.size}px`,
                    animationDelay: `${token.delay}s`,
                    animationDuration: `${token.duration * rainSpeed}s`,
                    '--token-drift': `${token.drift}px`,
                    '--token-drift-mid': `${token.drift * 0.55}px`,
                    '--token-spin': `${token.spin}deg`,
                    '--token-spin-mid': `${token.spin * 0.38}deg`,
                    '--token-spin-late': `${token.spin * 0.72}deg`,
                    '--token-face-duration': `${token.faceSpin}s`,
                    '--token-sway': `${token.sway}px`,
                    '--token-sway-start': `${token.sway * -0.45}px`,
                    '--token-scale': token.scale,
                    '--token-entry-scale': `${token.scale * 0.78}`,
                    '--token-exit-scale': `${token.scale * 0.72}`,
                    '--token-blur': `${token.blur}px`,
                  }}
                >
                  <img className="token-rain__image" src={tokenImg} alt="" />
                </span>
              ))}
            </div>
          </section>

          {/* 9. FINAL BUILDUP */}
          <section className="dw-card sec-final-buildup">
            <div className="pitch-black-fade" style={{ opacity: pitchBlackOpacity }}></div>
            <div className="center-block z-10">
              <p className="cinematic-line line-1 dw-card__text">The system is live.</p>
              <p className="cinematic-line line-2 mt-16 dw-card__text">Matches are being assigned.</p>
              <p className="cinematic-line line-3 mt-16 text-gold dw-card__text">You are already in the queue.</p>
            </div>
          </section>

          {/* HERO EXPERIENCE STRUCTURE */}
          <div className="heist-finale-sequence">
            {/* SECTION 1 - TOKYO */}
            <motion.section className="dw-card finale-sec finale-tokyo"
              initial={finaleMotion.initial}
              whileInView={finaleMotion.whileInView}
              viewport={finaleMotion.viewport}
              transition={finaleMotion.transition}
            >
              <div className="tokyo-bg base-layer" style={{ backgroundImage: `url(${tokyolImg})` }} />
              <div className="tokyo-bg reveal-layer" style={{
                backgroundImage: `url(${tokyolImg})`,
                maskImage: tokyoRevealMask,
                WebkitMaskImage: tokyoRevealMask,
              }} />
              <div
                className="tokyo-cursor-light"
                style={{
                  background: tokyoCursorGlow
                }}
              />
              <div className="typography-overlay">
                <motion.h1 className="finale-title vertical-text"
                  initial={finaleMotion.initial}
                  whileInView={finaleMotion.whileInView}
                  viewport={finaleMotion.viewport}
                  transition={{ ...finaleMotion.transition, delay: 0.1 }}
                >
                  TOKYO / 東京 / 東京
                </motion.h1>
                <motion.h1 className="finale-title mobile-title" aria-hidden="true"
                  initial={finaleMotion.initial}
                  whileInView={finaleMotion.whileInView}
                  viewport={finaleMotion.viewport}
                  transition={{ ...finaleMotion.transition, delay: 0.1 }}
                >
                  TOKYO / 東京
                </motion.h1>
              </div>
            </motion.section>

            {/* SECTION 2 - REOL */}
            <motion.section className="dw-card finale-sec finale-reol"
              initial={finaleMotion.initial}
              whileInView={finaleMotion.whileInView}
              viewport={finaleMotion.viewport}
              transition={finaleMotion.transition}
            >
              <div className="reol-container">
                <motion.img
                  src={riolImg}
                  alt="Reol"
                  className="reol-image"
                  initial={{ scale: 0.9 }}
                  whileInView={{ scale: 1.05 }}
                  viewport={finaleMotion.viewport}
                  transition={{ duration: 2.4, ease: "easeOut" }}
                />
                <div className="reol-glow" style={{
                  background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 0, 0, 0.4), transparent 400px)`
                }}></div>
              </div>
              <div className="reol-typography">
                <motion.h1 className="reol-title"
                  initial={{ filter: 'blur(20px)', opacity: 0, x: -50 }}
                  whileInView={{ filter: 'blur(0px)', opacity: 1, x: 0 }}
                  viewport={finaleMotion.viewport}
                  transition={{ duration: 0.9, staggerChildren: 0.1 }}
                >
                  RIO
                </motion.h1>
                <motion.h2 className="reol-subtitle"
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={finaleMotion.viewport} transition={{ delay: 0.2, duration: 0.7 }}
                >EASE OUT</motion.h2>
                <motion.h2 className="reol-subtitle red-accent"
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={finaleMotion.viewport} transition={{ delay: 0.38, duration: 0.7 }}
                >RELAX</motion.h2>
              </div>
            </motion.section>

            {/* SECTION 3 - BERLIN */}
            <motion.section className="dw-card finale-sec finale-berlin"
              initial={finaleMotion.initial}
              whileInView={finaleMotion.whileInView}
              viewport={finaleMotion.viewport}
              transition={finaleMotion.transition}
            >
              <div className="berlin-container">
                <motion.img
                  src={berlinlImg}
                  alt="Berlin"
                  className="berlin-image"
                  initial={{ scale: 0.8, filter: 'brightness(0) blur(10px)', y: 50, opacity: 0 }}
                  whileInView={{
                    scale: 1,
                    filter: 'brightness(1) blur(0px)',
                    y: 0,
                    opacity: 1
                  }}
                  animate={{
                    y: [0, -12, 0],
                    rotate: [0, 1, 0, -1, 0],
                    scale: [1, 1.03, 1]
                  }}
                  viewport={finaleMotion.viewport}
                  transition={{
                    duration: 1.8,
                    ease: "easeOut",
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                    scale: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                  }}
                />
              </div>
              <div className="berlin-typography">
                <motion.h1 className="berlin-title"
                  initial={{ opacity: 0, y: 40, skewY: 10 }}
                  whileInView={{ opacity: 1, y: 0, skewY: 0 }}
                  animate={{ textShadow: ["0 0 20px rgba(255,255,255,0.2)", "0 0 40px rgba(255,255,255,0.6)", "0 0 20px rgba(255,255,255,0.2)"] }}
                  viewport={finaleMotion.viewport}
                  transition={{
                    duration: 0.85,
                    textShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                  }}
                >WE WELCOME YOU!</motion.h1>
                <motion.h2 className="berlin-subtitle"
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={finaleMotion.viewport} transition={{ duration: 0.75, delay: 0.18 }}
                >THROW THE DICE</motion.h2>
                <motion.h2 className="berlin-subtitle"
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={finaleMotion.viewport} transition={{ duration: 0.75, delay: 0.32 }}
                >LET THE HEIST BEGIN</motion.h2>

                <motion.button
                  className="final-enter-btn heist-btn-animated"
                  onClick={handleEnterSystem}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={finaleMotion.viewport}
                  transition={{ duration: 0.7, delay: 0.58, type: 'spring' }}
                  whileHover={{ scale: 1.05, textShadow: "0px 0px 8px rgb(255,255,255)", boxShadow: "0px 0px 20px rgba(255,0,0,0.8)" }}
                >
                  ENTER HEIST
                </motion.button>

                <motion.div
                  className="mt-12 flex items-center gap-4 opacity-30 group"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 0.3 }}
                  viewport={finaleMotion.viewport}
                  transition={{ delay: 0.75 }}
                >
                  <img src={gdgLogo} alt="GDG" className="h-6 w-auto grayscale invert" />
                  <div className="h-8 w-[1px] bg-white/20"></div>
                  <div className="flex flex-col">
                    <span className="heist-mono text-[10px] tracking-[0.3em] uppercase">Authorized By</span>
                    <span className="heist-mono text-[8px] tracking-[0.1em] text-gray-500 uppercase">GDG RVITM // CHAPTER 2026</span>
                  </div>
                </motion.div>
              </div>
            </motion.section>
          </div>
        </div>
      )}

    </div>
  );
};

export default LandingScreen;
