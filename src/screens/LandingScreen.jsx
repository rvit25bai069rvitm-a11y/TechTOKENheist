import React, { useEffect, useState, useRef } from 'react';
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

const RAIN_TOKENS = Array.from({ length: 16 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;

  return {
    id: index,
    left: `${(index * 11) % 100}%`,
    size: 42 + (index % 4) * 12,
    delay: index * 0.35,
    duration: 5.6 + (index % 5) * 0.7,
    drift: side * (72 + index * 4),
    spin: 220 + index * 18,
  };
});

const LandingScreen = () => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const audioRef = useRef(null);

  const handleStart = () => {
    setStarted(true);
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
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
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

    const observer = new IntersectionObserver(observerCallback, { threshold: 0.25 });

    // Give React a tick to render the dw-cards
    setTimeout(() => {
      document.querySelectorAll('.dw-card').forEach(el => observer.observe(el));
    }, 100);

    return () => observer.disconnect();
  }, [started]);

  // Compute derived visual properties from scroll position
  // 100vh = window.innerHeight. Assuming sections are at least 100vh.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Background slowly becomes visible around section 1 (100vh) to section 2 (200vh)
  const bgOpacity = started ? Math.min(1, Math.max(0, (scrollY - vh * 0.5) / vh)) : 0;
  const bgScale = 1 + scrollY * 0.00008; // slow cinematic zoom-in

  // Darken everything heavily near the end (Section 9)
  const pitchBlackOpacity = Math.min(1, Math.max(0, (scrollY - vh * 7.5) / vh));

  // Phase 2 Red shift
  const phase2Active = scrollY > vh * 6;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const safeMouseX = mousePos.x >= 0 ? mousePos.x : viewportWidth / 2;
  const safeMouseY = mousePos.y >= 0 ? mousePos.y : vh / 2;
  const rainDriftX = ((safeMouseX / viewportWidth) - 0.5) * 220;
  const rainDriftY = ((safeMouseY / vh) - 0.5) * 90;
  const rainSpeed = started ? Math.max(0.35, 1 - (scrollY / (vh * 5)) * 0.65) : 1;

  return (
    <div
      className={`landing-container ${started ? 'is-started' : ''}`}
      style={{
        '--rain-drift-x': `${rainDriftX}px`,
        '--rain-drift-y': `${rainDriftY}px`,
      }}
    >
      <audio ref={audioRef} src={songMp3} loop />

      {/* 0. PRELUDE — SILENCE */}
      {!started && (
        <div className="prelude-overlay" onClick={handleStart}>
          <p className="prelude-text">you are invited</p>
        </div>
      )}

      {/* FIXED VAULT BACKGROUND (rvitm.png) */}
      <div
        className="vault-bg"
        style={{
          backgroundImage: `url(${rvitmImg})`,
          opacity: bgOpacity,
          transform: `scale(${bgScale})`,
          filter: phase2Active ? 'brightness(0.6) sepia(1) hue-rotate(320deg) saturate(3)' : 'brightness(0.5)',
          transition: 'filter 1s ease-out'
        }}
      />

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
                <p className="init-type-2">El sistema ya est&aacute; en marcha.</p>
                <p className="init-type-sub">El sistema ya est&aacute; en marcha.</p>
              </div>
            </div>
            <div className="scroll-pulse-indicator">
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
            <div className="floating-numbers">
              <span className="float-num fn-1">+1</span>
              <span className="float-num fn-2">-2</span>
              <span className="float-num fn-3">+5</span>
            </div>
            <div className="center-block">
              <p className="cinematic-line line-1 text-gold token-title">Tokens define your position.</p>
              <div className="mt-20">
                <p className="cinematic-line line-2 dw-card__text">Gain them.</p>
                <p className="cinematic-line line-3 mt-4 dw-card__text">Lose them.</p>
                <p className="cinematic-line line-4 mt-4 text-red dw-card__text">Or disappear.</p>
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

            <div className="phase-trigger-hit"></div>

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
                <img
                  key={token.id}
                  className="token-rain__token"
                  src={tokenImg}
                  alt=""
                  style={{
                    left: token.left,
                    width: `${token.size}px`,
                    height: `${token.size}px`,
                    animationDelay: `${token.delay}s`,
                    animationDuration: `${token.duration * rainSpeed}s`,
                    '--token-drift': `${token.drift}px`,
                    '--token-spin': `${token.spin}deg`,
                  }}
                />
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
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.65 }}
            >
              <div className="tokyo-bg base-layer" style={{ backgroundImage: `url(${tokyolImg})` }} />
              <div className="tokyo-bg reveal-layer" style={{
                backgroundImage: `url(${tokyolImg})`,
                maskImage: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, black 10%, transparent 100%)`,
                WebkitMaskImage: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, black 10%, transparent 100%)`,
                maskAttachment: 'fixed',
                WebkitMaskAttachment: 'fixed'
              }} />
              <div className="typography-overlay">
                <motion.h1 className="finale-title vertical-text"
                  initial={{ opacity: 0, letterSpacing: '10px' }}
                  whileInView={{ opacity: 1, letterSpacing: '30px' }}
                  transition={{ duration: 2 }}
                >
                  TOKYO / 東京 / 東京
                </motion.h1>
              </div>
            </motion.section>

            {/* SECTION 2 - REOL */}
            <motion.section className="dw-card finale-sec finale-reol"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.6 }}
            >
              <div className="rio-container">
                <motion.img
                  src={riolImg}
                  alt="Reol"
                  className="reol-image"
                  initial={{ scale: 0.9 }}
                  whileInView={{ scale: 1.05 }}
                  transition={{ duration: 4, ease: "easeOut" }}
                />
                <div className="reol-glow" style={{
                  background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 0, 0, 0.4), transparent 400px)`
                }}></div>
              </div>
              <div className="reol-typography">
                <motion.h1 className="reol-title"
                  initial={{ filter: 'blur(20px)', opacity: 0, x: -50 }}
                  whileInView={{ filter: 'blur(0px)', opacity: 1, x: 0 }}
                  transition={{ duration: 1.5, staggerChildren: 0.2 }}
                >
                  RIO
                </motion.h1>
                <motion.h2 className="reol-subtitle"
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }}
                >EASE OUT</motion.h2>
                <motion.h2 className="reol-subtitle red-accent"
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }}
                >RELAX</motion.h2>
              </div>
            </motion.section>

            {/* SECTION 3 - BERLIN */}
            <motion.section className="dw-card finale-sec finale-berlin"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.85 }}
            >
              <div className="berlin-container">
                <motion.img
                  src={berlinlImg}
                  alt="Berlin"
                  className="berlin-image"
                  initial={{ scale: 1.2, filter: 'brightness(0.2)' }}
                  whileInView={{ scale: 1, filter: 'brightness(1)' }}
                  transition={{ duration: 3, ease: "easeOut" }}
                />
              </div>
              <div className="berlin-typography">
                <motion.h1 className="berlin-title"
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 1.5 }}
                >WE WELCOME YOU!</motion.h1>
                <motion.h2 className="berlin-subtitle"
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, delay: 0.3 }}
                >THROW THE DICE</motion.h2>
                <motion.h2 className="berlin-subtitle"
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, delay: 0.6 }}
                >LET THE HEIST BEGIN</motion.h2>

                <motion.button
                  className="final-enter-btn heist-btn-animated"
                  onClick={handleEnterSystem}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 1.5, type: 'spring' }}
                  whileHover={{ scale: 1.05, textShadow: "0px 0px 8px rgb(255,255,255)", boxShadow: "0px 0px 20px rgba(255,0,0,0.8)" }}
                >
                  ENTER HEIST
                </motion.button>

                <motion.div 
                  className="mt-12 flex items-center gap-4 opacity-30 group"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 0.3 }}
                  transition={{ delay: 2 }}
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
