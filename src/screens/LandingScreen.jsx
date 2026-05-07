import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingScreen.css';
import rvitmImg from '../assets/rvitm.png';
import songMp3 from '../assets/song.mp3';

const LandingScreen = () => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [scrollY, setScrollY] = useState(0);
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
    setTransitioning(true);
    
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
    
    // Total sequence is ~2.5s
    setTimeout(() => {
      navigate('/login');
    }, 2500); 
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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
    
    // Give React a tick to render the cinematic-sections
    setTimeout(() => {
      document.querySelectorAll('.cinematic-section').forEach(el => observer.observe(el));
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

  return (
    <div className="landing-container">
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
           <section className="cinematic-section sec-init is-active">
             <div className="typewriter-box">
                <p className="init-type-1">El mayor robo comienza ahora...</p>
                <div className="init-glitch-replace">
                   <p className="init-type-2">El sistema ya est&aacute; en marcha.</p>
                   <p className="init-type-sub">The system is already in motion.</p>
                </div>
             </div>
             <div className="scroll-pulse-indicator">
                <div className="arrow"></div>
             </div>
           </section>

           {/* 2. VAULT EMERGENCE */}
           <section className="cinematic-section sec-emergence">
             <div className="text-left-block">
               <p className="cinematic-line line-1">This is not a game.</p>
               <p className="cinematic-line line-2 mt-20">This is a controlled system.</p>
             </div>
           </section>

           {/* 3. SYSTEM REVEAL (OVERLAY UI) */}
           <section className="cinematic-section sec-system-reveal">
             <div className="grid-overlay"></div>
             <div className="coords-overlay">SYS.COORD: [40.4168° N, 3.7038° W]</div>
             <div className="nodes-container">
                <div className="sys-node n1"></div>
                <div className="sys-node n2"></div>
                <div className="sys-node n3"></div>
                <div className="sys-node n4"></div>
             </div>
             
             <div className="text-right-block">
               <p className="cinematic-line line-1">No inputs.</p>
               <p className="cinematic-line line-2 mt-4">No decisions.</p>
               <p className="cinematic-line line-3 mt-4">No control.</p>
               <p className="cinematic-line line-4 mt-16 text-red glow-text">Only outcomes.</p>
             </div>
           </section>

           {/* 4. MATCHMAKING VISUALIZATION */}
           <section className="cinematic-section sec-matchmaking">
             <div className="darker-overlay"></div>
             <div className="animated-system-lines">
               {/* Abstract connecting lines */}
               <div className="connecting-line l1"></div>
               <div className="connecting-line l2"></div>
               <div className="connecting-line l3"></div>
             </div>
             
             <div className="center-block text-left">
                <p className="cinematic-line line-1">Teams are assigned.</p>
                <p className="cinematic-line line-2 mt-4">Matches are created.</p>
                <p className="cinematic-line line-3 mt-4">Domains are allocated.</p>
             </div>
             
             <div className="system-logs-corner">
                <p className="log-msg log-1">&gt; MATCH FOUND</p>
                <p className="log-msg log-2">&gt; ASSIGNING DOMAIN...</p>
                <p className="log-msg log-3">&gt; TIMER INITIALIZED</p>
             </div>
           </section>

           {/* 5. IDENTITY / MASK MOMENT */}
           <section className="cinematic-section sec-identity">
              <div className="silhouettes">
                 <div className="silhouette-box"><div className="id-glitch id-1">TEAM_01</div></div>
                 <div className="silhouette-box"><div className="id-glitch id-2">TEAM_02</div></div>
                 <div className="silhouette-box"><div className="id-glitch id-3">TEAM_03</div></div>
              </div>
              <div className="center-block-bottom">
                 <p className="cinematic-line line-1">Identity is assigned.</p>
                 <p className="cinematic-line line-2 mt-4">Not chosen.</p>
              </div>
           </section>

           {/* 6. TOKEN SYSTEM */}
           <section className="cinematic-section sec-tokens">
              <div className="floating-numbers">
                <span className="float-num fn-1">+1</span>
                <span className="float-num fn-2">-2</span>
                <span className="float-num fn-3">+5</span>
              </div>
              <div className="center-block">
                 <p className="cinematic-line line-1 text-gold token-title">Tokens define your position.</p>
                 <div className="mt-20">
                   <p className="cinematic-line line-2">Gain them.</p>
                   <p className="cinematic-line line-3 mt-4">Lose them.</p>
                   <p className="cinematic-line line-4 mt-4 text-red">Or disappear.</p>
                 </div>
              </div>
           </section>

           {/* 7. PHASE TRANSITION */}
           <section className="cinematic-section sec-phase">
              <div className="phase-1-block">
                 <h2 className="phase-title text-blue">Phase 1</h2>
                 <p className="cinematic-line p1-l1 mt-4">Controlled.</p>
                 <p className="cinematic-line p1-l2 mt-2">Balanced.</p>
                 <p className="cinematic-line p1-l3 mt-2">Predictable.</p>
              </div>
              
              <div className="phase-trigger-hit"></div>
              
              <div className="phase-2-block">
                 <h2 className="phase-title text-red glitch" data-text="Phase 2">Phase 2</h2>
                 <p className="cinematic-line p2-l1 mt-4">Constraints removed.</p>
                 <p className="cinematic-line p2-l2 mt-2">Risk amplified.</p>
                 <p className="cinematic-line p2-l3 mt-12 text-red glow-text">Loss is permanent.</p>
              </div>
           </section>

           {/* 8. PARTICLE / MONEY RAIN */}
           <section className="cinematic-section sec-particles">
              <div className="gold-shards-rain">
                {/* Generated via CSS multiple box shadows */}
              </div>
              <div className="system-logs-flashing">
                 <p className="flash-log fl-1">TOKEN TRANSFER</p>
                 <p className="flash-log fl-2 text-red">ELIMINATION</p>
                 <p className="flash-log fl-3 text-gold">LEADERBOARD UPDATED</p>
              </div>
           </section>

           {/* 9. FINAL BUILDUP */}
           <section className="cinematic-section sec-final-buildup">
              <div className="pitch-black-fade" style={{ opacity: pitchBlackOpacity }}></div>
              <div className="center-block z-10">
                 <p className="cinematic-line line-1">The system is live.</p>
                 <p className="cinematic-line line-2 mt-16">Matches are being assigned.</p>
                 <p className="cinematic-line line-3 mt-16 text-gold">You are already in the queue.</p>
              </div>
           </section>

           {/* 10. FINAL CTA FORMATION */}
           <section className="cinematic-section sec-cta">
              <div className="pitch-black-fade" style={{ opacity: pitchBlackOpacity }}></div>
              <div className="cta-container">
                 <div className="particles-converge"></div>
                 <button className="final-enter-btn" onClick={handleEnterSystem}>
                    ENTER SYSTEM
                 </button>
              </div>
           </section>

        </div>
      )}

      {/* 11. CLICK TRANSITION */}
      {transitioning && (
        <div className="transition-overlay">
           <div className="system-glitch-hit"></div>
           <div className="red-flash-hit"></div>
           <div className="auth-logs">
              <p className="auth-step-1">&gt; AUTHENTICATING...</p>
              <p className="auth-step-2">&gt; ROLE: TEAM</p>
              <p className="auth-step-3 text-red glow-text">&gt; ACCESS GRANTED</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default LandingScreen;
