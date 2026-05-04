import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { rulebookSections, rulebookDomains, rulebookFlow, rulebookConstraints, rulebookAdminDuties, rulebookImportantNotes, rulebookPhase2, rulebookGameplayNotes } from '../data/rulebookData';
import { BookOpen, ChevronDown, ChevronUp, Swords, Users, Zap, ShieldAlert, Target } from 'lucide-react';
import { useGameState } from '../hooks/useGameState';

const CollapsibleSection = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <button onClick={() => setOpen(!open)} className="flex justify-between items-center w-full" style={{ padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-heading" style={{ fontSize: '1.15rem' }}>{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
      </button>
      {open && <div style={{ padding: '0 1.25rem 1.25rem' }}>{children}</div>}
    </div>
  );
};

const RulebookScreen = () => {
  const { gameState } = useGameState();
  const domains = gameState?.domains || rulebookDomains;

  return (
    <motion.div className="flex-col gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center gap-3 mb-4">
        <BookOpen className="text-warning" size={28} />
        <h1 className="font-heading" style={{ fontSize: '2rem', margin: 0 }}>RULEBOOK</h1>
      </div>

      <CollapsibleSection title="GAME OVERVIEW" icon={<Target size={18} className="text-survival" />} defaultOpen={true}>
        <div className="rules-grid">
          {rulebookSections.map(s => (
            <div key={s.key} className="rule-card"><h3>{s.title}</h3><p>{s.body}</p></div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="DOMAINS" icon={<Zap size={18} className="text-warning" />}>
        <div className="flex flex-wrap gap-3">
          {domains.map((d, i) => (
            <div key={i} className="badge badge-cyan" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>{d}</div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="MATCH FLOW" icon={<Swords size={18} className="text-danger" />}>
        <ol className="font-mono" style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '2' }}>
          {rulebookFlow.map((step, i) => <li key={i} style={{ color: 'var(--text-muted)' }}>{step}</li>)}
        </ol>
      </CollapsibleSection>

      <CollapsibleSection title="MATCH CONSTRAINTS" icon={<ShieldAlert size={18} className="text-magenta" />}>
        <ul className="font-mono" style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '2' }}>
          {rulebookConstraints.map((c, i) => <li key={i} style={{ color: 'var(--text-muted)' }}>{c}</li>)}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="PHASE 2 — WAGER MODE" icon={<Zap size={18} className="text-magenta" />}>
        <div className="rules-grid">
          {rulebookPhase2.map(s => (
            <div key={s.key} className="rule-card" style={{ borderColor: 'rgba(255, 95, 143, 0.35)', background: 'rgba(255, 95, 143, 0.04)' }}>
              <h3 style={{ color: 'var(--accent-magenta)' }}>{s.title}</h3><p>{s.body}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="ADMIN DUTIES" icon={<Users size={18} className="text-cyan" />}>
        <ul className="font-mono" style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '2' }}>
          {rulebookAdminDuties.map((d, i) => <li key={i} style={{ color: 'var(--text-muted)' }}>{d}</li>)}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="GAMEPLAY NOTES" icon={<BookOpen size={18} className="text-survival" />}>
        <div className="rules-grid">
          {rulebookGameplayNotes.map(s => (
            <div key={s.key} className="rule-card"><h3>{s.title}</h3><p>{s.body}</p></div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="IMPORTANT NOTES" icon={<ShieldAlert size={18} className="text-warning" />}>
        <ul className="font-mono" style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '2' }}>
          {rulebookImportantNotes.map((n, i) => <li key={i} style={{ color: 'var(--accent-warning)' }}>{n}</li>)}
        </ul>
      </CollapsibleSection>
    </motion.div>
  );
};

export default RulebookScreen;
