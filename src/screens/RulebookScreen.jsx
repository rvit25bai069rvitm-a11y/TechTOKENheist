import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { rulebookSections, rulebookDomains, rulebookFlow, rulebookConstraints, rulebookAdminDuties, rulebookImportantNotes, rulebookPhase2, rulebookGameplayNotes } from '../data/rulebookData';
import { BookOpen, ChevronDown, ChevronUp, Swords, Users, Zap, ShieldAlert, Target, VenetianMask } from 'lucide-react';
import { useGameState } from '../hooks/useGameState';
import './AdminScreen.css';

const CollapsibleSection = ({ title, icon, children, defaultOpen = false, borderColor = 'border-[#333]' }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`panel-container border-2 ${borderColor} bg-black bg-opacity-80 mb-4 transition-all duration-300`}>
      <button onClick={() => setOpen(!open)} className="flex justify-between items-center w-full p-4 md:p-6 bg-transparent border-none cursor-pointer text-white hover:bg-gray-900 transition-colors">
        <div className="flex items-center gap-3">
          {icon}
          <span className="heist-font text-2xl tracking-widest uppercase">{title}</span>
        </div>
        {open ? <ChevronUp size={24} className="text-gray-500" /> : <ChevronDown size={24} className="text-gray-500" />}
      </button>
      {open && <div className="px-4 pb-6 md:px-6 md:pb-6 border-t border-gray-800 pt-4">{children}</div>}
    </div>
  );
};

const RulebookScreen = () => {
  const { gameState } = useGameState();
  const domains = gameState?.domains || rulebookDomains;

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <motion.div className="flex flex-col gap-2 relative z-10" variants={containerVariants} initial="hidden" animate="visible">
      <div className="flex items-center gap-4 mb-6 border-b-2 border-heist-red pb-4">
        <BookOpen className="text-heist-red" size={36} />
        <h1 className="heist-font text-heist-red text-5xl tracking-widest m-0">THE PLAN (RULES)</h1>
      </div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="OPERATION OVERVIEW" icon={<Target size={24} className="text-heist-teal" />} defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rulebookSections.map(s => (
              <div key={s.key} className="p-4 border border-gray-700 bg-gray-900 bg-opacity-50">
                <h3 className="heist-font text-white text-2xl tracking-wider mb-2">{s.title}</h3>
                <p className="heist-mono text-gray-400 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="DOMAINS OF EXPERTISE" icon={<Zap size={24} className="text-heist-yellow" />} borderColor="border-heist-yellow">
          <div className="flex flex-wrap gap-3">
            {domains.map((d, i) => (
              <div key={i} className="px-4 py-2 border border-heist-yellow text-heist-yellow bg-yellow-900 bg-opacity-20 heist-mono text-sm uppercase tracking-widest">
                {d}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="INFILTRATION FLOW" icon={<Swords size={24} className="text-heist-red" />}>
          <ol className="heist-mono text-gray-400 text-sm leading-loose list-decimal pl-6 marker:text-heist-red">
            {rulebookFlow.map((step, i) => <li key={i} className="pl-2 mb-2">{step}</li>)}
          </ol>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="MATCH CONSTRAINTS" icon={<ShieldAlert size={24} className="text-heist-teal" />}>
          <ul className="heist-mono text-gray-400 text-sm leading-loose list-disc pl-6 marker:text-heist-teal">
            {rulebookConstraints.map((c, i) => <li key={i} className="pl-2 mb-2">{c}</li>)}
          </ul>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="PHASE 2 — WAGER MODE" icon={<Zap size={24} className="text-heist-red" />} borderColor="border-heist-red">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rulebookPhase2.map(s => (
              <div key={s.key} className="p-4 border border-heist-red bg-red-900 bg-opacity-20">
                <h3 className="heist-font text-heist-red text-2xl tracking-wider mb-2">{s.title}</h3>
                <p className="heist-mono text-gray-300 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="THE PROFESSOR'S DUTIES" icon={<VenetianMask size={24} className="text-white" />}>
          <ul className="heist-mono text-gray-400 text-sm leading-loose list-disc pl-6 marker:text-white">
            {rulebookAdminDuties.map((d, i) => <li key={i} className="pl-2 mb-2">{d}</li>)}
          </ul>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="EXECUTION NOTES" icon={<BookOpen size={24} className="text-heist-teal" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rulebookGameplayNotes.map(s => (
              <div key={s.key} className="p-4 border border-gray-700 bg-gray-900 bg-opacity-50">
                <h3 className="heist-font text-white text-2xl tracking-wider mb-2">{s.title}</h3>
                <p className="heist-mono text-gray-400 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="CRITICAL DIRECTIVES" icon={<ShieldAlert size={24} className="text-heist-yellow" />} borderColor="border-heist-yellow">
          <ul className="heist-mono text-heist-yellow text-sm leading-loose list-disc pl-6 marker:text-heist-yellow">
            {rulebookImportantNotes.map((n, i) => <li key={i} className="pl-2 mb-2">{n}</li>)}
          </ul>
        </CollapsibleSection>
      </motion.div>
    </motion.div>
  );
};

export default RulebookScreen;
