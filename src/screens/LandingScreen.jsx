import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Shield, Users, ArrowRight, Lock, BookOpen, AlertTriangle, CheckCircle2, Timer, TimerReset, Target } from 'lucide-react';
import { rulebookSections, rulebookFlow, rulebookAdminMoments, rulebookAdminDuties, rulebookImportantNotes, rulebookGameplayNotes } from '../data/rulebookData';

const LandingScreen = () => {
  const navigate = useNavigate();

  const rulebookIcons = {
    overview: <BookOpen size={22} className="text-cyan" />,
    'team-structure': <Users size={22} className="text-magenta" />,
    'token-system': <Coins size={22} className="text-warning" />,
    matchmaking: <Target size={22} className="text-success" />,
    'timeout-system': <Timer size={22} className="text-warning" />
  };

  return (
    <div className="landing-page">
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ marginBottom: '1.5rem', animation: 'float 3s ease-in-out infinite' }}>
          <div style={{
            width: '80px', height: '80px', margin: '0 auto',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta))',
            borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', fontWeight: '900', color: '#000',
            boxShadow: '0 0 40px rgba(0,255,255,0.3), 0 0 80px rgba(255,0,255,0.15)'
          }}>
            TH
          </div>
        </div>

        {/* Title */}
        <h1 className="landing-title text-gradient">Tech Token Heist</h1>
        <p className="landing-subtitle">
          A real-time competitive tournament where teams battle across 5 tech domains,
          stake tokens, and fight for supremacy. Strategy. Skill. Domination.
        </p>

        {/* Rulebook */}
        <div className="glass-panel" style={{ maxWidth: '980px', width: '100%', margin: '0 auto 2rem', padding: '1.5rem', textAlign: 'left', border: '1px solid rgba(0,255,255,0.18)' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
            <div className="badge badge-cyan" style={{ padding: '0.35rem 0.8rem' }}>
              <Lock size={12} /> UNLOCKED BEFORE START
            </div>
            <div className="badge badge-warning" style={{ padding: '0.35rem 0.8rem' }}>
              OFFICIAL RULEBOOK
            </div>
          </div>

          <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
            <BookOpen className="text-cyan" size={24} />
            <h2 className="orbitron" style={{ fontSize: '1.35rem', letterSpacing: '0.08em' }}>TECH TOKEN HEIST - RULEBOOK</h2>
          </div>

          <p className="text-muted" style={{ marginBottom: '1.25rem', lineHeight: 1.7 }}>
            This rulebook stays visible before the game starts so every player can review the full match structure, timeout rules, and admin process.
          </p>

          <div className="rules-grid" style={{ marginBottom: '1.5rem' }}>
            {rulebookSections.map((rule, i) => (
              <div key={i} className="rule-card">
                <div style={{ marginBottom: '0.75rem' }}>{rulebookIcons[rule.key]}</div>
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <section style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                <Shield className="text-cyan" size={18} />
                <h3 style={{ fontSize: '1rem' }}>Match Flow</h3>
              </div>
              <ol style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                {rulebookFlow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <section style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                <AlertTriangle className="text-warning" size={18} />
                <h3 style={{ fontSize: '1rem' }}>When To Approach Admin</h3>
              </div>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                {rulebookAdminMoments.map((moment) => (
                  <li key={moment}>{moment}</li>
                ))}
              </ul>
            </section>

            <section style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                <CheckCircle2 className="text-success" size={18} />
                <h3 style={{ fontSize: '1rem' }}>Admin Responsibilities</h3>
              </div>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                {rulebookAdminDuties.map((duty) => (
                  <li key={duty}>{duty}</li>
                ))}
              </ul>
            </section>

            <section style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                <TimerReset className="text-magenta" size={18} />
                <h3 style={{ fontSize: '1rem' }}>Important Notes</h3>
              </div>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
                {rulebookImportantNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="glass-panel" style={{ maxWidth: '980px', width: '100%', margin: '0 auto 2rem', padding: '1.5rem', textAlign: 'left' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
            <BookOpen className="text-cyan" size={22} />
            <h2 className="orbitron" style={{ fontSize: '1.1rem', letterSpacing: '0.08em', margin: 0 }}>GAMEPLAY NOTES</h2>
          </div>
          <div className="rules-grid" style={{ marginBottom: 0 }}>
            {rulebookGameplayNotes.map((rule) => (
              <div key={rule.key} className="rule-card">
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it Works */}
        <div className="enter-btn" style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-block', padding: '1rem 2rem',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', maxWidth: '500px', textAlign: 'left'
          }}>
            <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent-warning)' }}>📋 How to Play</h4>
            <ol style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
              <li>Admin registers all teams and provides credentials</li>
              <li>Login with your team name and password</li>
              <li>Wait for admin to start the game</li>
              <li>Join the matchmaking queue in the Arena</li>
              <li>Get auto-matched, admin spins domain wheel</li>
              <li>Battle it out and claim tokens!</li>
            </ol>
          </div>
        </div>

        {/* CTA */}
        <div className="enter-btn">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/login')}
            style={{ fontSize: '1.1rem', padding: '1.25rem 3rem' }}
          >
            Enter the Game <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
