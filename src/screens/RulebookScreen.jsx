import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { rulebookSections, rulebookDomains, rulebookFlow, rulebookConstraints, rulebookAdminDuties, rulebookImportantNotes, rulebookPhase2, rulebookGameplayNotes } from '../data/rulebookData';
import { BookOpen, ChevronDown, Swords, Zap, ShieldAlert, Target, VenetianMask } from 'lucide-react';
import { useGameState } from '../hooks/useGameState';

const CollapsibleSection = ({ title, icon, children, defaultOpen = false, accentColor = 'var(--heist-red)' }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="heist-card mb-6 group">
      <button 
        onClick={() => setOpen(!open)} 
        className={`flex justify-between items-center w-full p-6 bg-transparent border-none cursor-pointer text-white hover:bg-white/5 transition-all ${open ? 'bg-white/2' : ''}`}
      >
        <div className="flex items-center gap-6">
          <div className="p-3 bg-white/5 border border-white/5 rounded-sm group-hover:border-red-600/30 transition-colors" style={{ color: accentColor }}>
             {icon}
          </div>
          <span className="heist-font text-3xl tracking-[0.2em] uppercase m-0 leading-none mt-1 group-hover:text-red-500 transition-colors">{title}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown size={28} className="text-gray-700" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} 
            className="overflow-hidden"
          >
             <div className="p-8 bg-black/40 border-t border-white/5 relative">
                <div className="scanline-overlay opacity-5"></div>
                <div className="blueprint-grid absolute inset-0 opacity-5"></div>
                <div className="relative z-10">
                  {children}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RulebookScreen = () => {
  const { gameState } = useGameState();
  const domains = gameState?.domains || rulebookDomains;

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <motion.div className="flex flex-col gap-2 relative text-white h-full pb-20" variants={containerVariants} initial="hidden" animate="visible">
      
      {/* Tactical Header */}
      <motion.div variants={itemVariants} className="heist-header-tactical mb-12">
        <div>
          <h1 className="heist-title-main">THE <span className="heist-title-accent">PLAN</span></h1>
          <span className="heist-subtitle-mono">OFFICIAL OPERATIONAL DIRECTIVES & PARAMETERS</span>
        </div>
        <div className="flex flex-col items-end">
          <div className="heist-badge badge-red mb-2">CLASSIFIED MATERIAL</div>
          <div className="heist-mono text-[9px] text-gray-600 tracking-widest">VERSION 2.4.0 // NEURAL LINK STABLE</div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="OPERATION OVERVIEW" icon={<Target size={24} />} defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {rulebookSections.map(s => (
              <div key={s.key} className="relative p-6 border-l-2 border-white/10 hover:border-red-600 transition-all group">
                <h3 className="heist-font text-white text-3xl tracking-widest mb-4 uppercase group-hover:text-red-500 transition-colors">{s.title}</h3>
                <p className="heist-mono text-gray-400 text-[11px] leading-relaxed tracking-wide uppercase">{s.body}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="DOMAINS OF EXPERTISE" icon={<Zap size={24} />} accentColor="var(--heist-teal)">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {domains.map((d, i) => (
              <div key={i} className="heist-card p-4 text-center hover:border-teal-500/50 transition-all cursor-default group">
                <span className="heist-mono text-[10px] text-teal-500 uppercase tracking-[0.2em] group-hover:scale-110 block transition-transform">{d}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="INFILTRATION FLOW" icon={<Swords size={24} />}>
          <div className="flex flex-col gap-4">
            {rulebookFlow.map((step, i) => (
              <div key={i} className="flex gap-6 items-start p-4 bg-white/2 border border-white/5 hover:border-red-600/20 transition-all">
                <span className="heist-font text-4xl text-red-600 leading-none opacity-50">{(i + 1).toString().padStart(2, '0')}</span>
                <p className="heist-mono text-gray-300 text-xs tracking-widest uppercase leading-loose">{step}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="MATCH CONSTRAINTS" icon={<ShieldAlert size={24} />} accentColor="#666">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rulebookConstraints.map((c, i) => (
              <div key={i} className="p-4 border-b border-white/5 flex items-start gap-4">
                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-1.5 shrink-0"></div>
                <p className="heist-mono text-gray-400 text-[10px] tracking-widest uppercase leading-relaxed">{c}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="PHASE 2 — WAGER MODE" icon={<Zap size={24} className="animate-pulse" />} accentColor="var(--heist-red)" defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {rulebookPhase2.map(s => (
              <div key={s.key} className="heist-card border-red-900/30 bg-red-950/10 p-8 hover:border-red-600 transition-all group">
                <h3 className="heist-font text-red-500 text-4xl tracking-widest mb-4 uppercase">{s.title}</h3>
                <p className="heist-mono text-gray-300 text-xs leading-loose tracking-widest uppercase">{s.body}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="THE PROFESSOR'S DUTIES" icon={<VenetianMask size={24} />} accentColor="#999">
          <div className="flex flex-col gap-3">
            {rulebookAdminDuties.map((d, i) => (
              <div key={i} className="p-4 bg-black/60 border border-white/5 flex items-center gap-6">
                <div className="w-8 h-px bg-red-900/50"></div>
                <p className="heist-mono text-gray-500 text-[10px] tracking-widest uppercase">{d}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="EXECUTION NOTES" icon={<BookOpen size={24} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {rulebookGameplayNotes.map(s => (
              <div key={s.key} className="relative p-6 bg-white/2 border-r border-white/5">
                <h3 className="heist-font text-gray-300 text-3xl tracking-widest mb-4 uppercase">{s.title}</h3>
                <p className="heist-mono text-gray-400 text-[10px] leading-relaxed tracking-widest uppercase">{s.body}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </motion.div>

      <motion.div variants={itemVariants}>
        <CollapsibleSection title="CRITICAL DIRECTIVES" icon={<ShieldAlert size={24} />} accentColor="#EAB308">
          <div className="bg-yellow-950/10 border border-yellow-900/30 p-8">
            <ul className="flex flex-col gap-6 m-0 p-0 list-none">
              {rulebookImportantNotes.map((n, i) => (
                <li key={i} className="flex gap-6 items-start">
                  <span className="text-yellow-600 font-bold heist-mono text-xl">!</span>
                  <p className="heist-mono text-yellow-600/80 text-xs tracking-widest uppercase leading-relaxed m-0">{n}</p>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleSection>
      </motion.div>
    </motion.div>
  );
};

export default RulebookScreen;
