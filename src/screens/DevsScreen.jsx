import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images from assets directory
import dev1 from '../../assets/dev1.png';
import admin1 from '../../assets/admin1.png';
import prat from '../../assets/prat.png';
import admin2 from '../../assets/admin2.png';

const DevCard = ({ name, role, description, photo, hoverPhoto, links }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="relative w-full max-w-[400px] h-[550px] perspective-1000 group cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="w-full h-full relative preserve-3d"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* Front Face - Operative Profile */}
        <div className="absolute inset-0 w-full h-full backface-hidden heist-card overflow-hidden group-hover:border-red-600 transition-colors duration-500">
          <div className="scanline-overlay opacity-5"></div>
          <div className="relative h-2/3 overflow-hidden">
            <img
              src={photo}
              alt={name}
              className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            <div className="absolute top-6 left-6">
              <div className="heist-badge badge-red shadow-[0_0_15px_rgba(211,47,47,0.4)]">
                OPERATIVE STATUS: ACTIVE
              </div>
            </div>
          </div>

          <div className="p-8 h-1/3 flex flex-col justify-start relative z-10">
            <h3 className="heist-font text-4xl text-white tracking-widest mb-2 uppercase group-hover:text-red-500 transition-colors">{name}</h3>
            <p className="heist-mono text-red-600 text-[10px] tracking-[0.3em] uppercase font-bold mb-6">{role}</p>
            <div className="w-12 h-0.5 bg-red-600/50 group-hover:w-full transition-all duration-500" />
          </div>
        </div>

        {/* Back Face - Tactical Dossier */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden heist-card border-red-600 bg-black rotate-y-180 overflow-hidden"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <div className="blueprint-grid absolute inset-0 opacity-10"></div>
          <div className="relative h-1/2 overflow-hidden border-b border-red-600/30">
            <img
              src={hoverPhoto}
              alt={`${name} Admin`}
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div className="absolute top-6 left-6">
              <div className="bg-white text-black px-4 py-1.5 heist-mono text-[9px] tracking-[0.3em] font-bold animate-pulse uppercase">
                RESTRICTED // CLEARANCE LEVEL: S
              </div>
            </div>
          </div>

          <div className="p-8 h-1/2 overflow-y-auto custom-scrollbar relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <div className="w-1 h-1 bg-red-600 rounded-full"></div>
               <span className="heist-mono text-[10px] text-red-500 tracking-widest uppercase font-bold">BACKGROUND INTEL</span>
            </div>
            <p className="heist-mono text-gray-400 text-[11px] leading-relaxed tracking-wider uppercase text-justify">
              {description}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Persistent Interaction Layer */}
      <div className="absolute bottom-8 left-8 flex gap-6 z-30 pointer-events-auto">
        {links.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-white transition-all flex items-center gap-2 group/link"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="heist-mono text-[9px] tracking-[0.2em] uppercase">{link.label}</span>
            <span className="text-xs transform group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform opacity-50 group-hover/link:opacity-100">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
};

const DevsScreen = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const devs = [
    {
      name: "Harsh Joshi",
      role: "Frontend Specialist / UX Engineer",
      description: "The creative force that brought the industrial aesthetic of the Google Developer Groups to life. Harsh excels in crafting immersive, cinematic user experiences using advanced animation libraries and modern CSS frameworks. His dedication to pixel-perfect design guarantees that every interaction feels premium and impactful.",
      photo: dev1,
      hoverPhoto: admin1,
      links: [
        { label: "LINKEDIN", url: "#" },
        { label: "INSTAGRAM", url: "https://www.instagram.com/hardahmm?igsh=MWhmbmNoZHRiMWY3Mw==" },
        { label: "MAGIC URL", url: "#" }
      ]
    },
    {
      name: "Pratyush Jaiswal",
      role: "Lead Full Stack Engineer / System Architect",
      description: "The mastermind behind the core architecture of the Google Developer Groups platform. Pratyush specializes in building high-performance, resilient web applications. With a keen eye for system design and database management, he ensures the platform can handle the intense load of a live combat tournament without breaking a sweat.",
      photo: prat,
      hoverPhoto: admin2,
      links: [
        { label: "LINKEDIN", url: "#" },
        { label: "INSTAGRAM", url: "https://www.instagram.com/been__there_done_that?igsh=bzRybHl3a2VxbzZo" },
        { label: "MAGIC URL", url: "#" }
      ]
    }
  ];

  return (
    <motion.div className="text-white relative flex flex-col gap-12 h-full pb-20" variants={containerVariants} initial="hidden" animate="visible">
      
      {/* TACTICAL HEADER */}
      <motion.div variants={itemVariants} className="heist-header-tactical mb-12">
        <div>
          <h1 className="heist-title-main">THE <span className="heist-title-accent">ARCHITECTS</span></h1>
          <span className="heist-subtitle-mono">SYSTEM DESIGN & OPERATIONAL OVERVIEW</span>
        </div>
        <div className="flex flex-col items-end">
          <div className="heist-badge badge-teal mb-2">AUTHORED CONTENT</div>
          <div className="heist-mono text-[9px] text-gray-600 tracking-widest uppercase">ENCRYPTED // BYPASS DISABLED</div>
        </div>
      </motion.div>

      {/* Cards Grid */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start"
      >
        {devs.map((dev, idx) => (
          <DevCard key={idx} {...dev} />
        ))}
      </motion.div>

      {/* Cinematic Background Decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none -z-10 opacity-[0.02]">
        <div className="blueprint-grid w-full h-full"></div>
      </div>
      
      <div className="fixed bottom-0 right-0 p-12 opacity-5 pointer-events-none hidden lg:block">
        <h2 className="heist-font text-[18rem] leading-none select-none tracking-tighter">HEIST</h2>
      </div>
    </motion.div>
  );
};

export default DevsScreen;
