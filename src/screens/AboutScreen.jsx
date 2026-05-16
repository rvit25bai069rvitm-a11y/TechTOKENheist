import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import rvitmImg from '../assets/rvitm.png';
import rishiImg from '../assets/rishi.png';
import aneeshImg from '../assets/aneesh.png';
import biswaImg from '../assets/biswa.png';
import pratImg from '../assets/prat.png';
import gdg from '../../assets/gdg.png';

const offers = [
    {
        id: '01',
        title: 'Educational Workshops',
        body: 'We organize hands-on workshops, hackathons, and coding competitions to enhance your technical skills and problem-solving abilities.'
    },
    {
        id: '02',
        title: 'Networking Opportunities',
        body: 'Connect with fellow students who share your passion for technology and innovation. Build valuable connections with industry professionals and mentors.'
    },
    {
        id: '03',
        title: 'Real-World Projects',
        body: 'Get involved in impactful projects that address real-world challenges, giving you practical experience and a chance to make a difference.'
    },
    {
        id: '04',
        title: 'Community Engagement',
        body: 'We believe in giving back to the community. Join us in organizing tech events, workshops, and initiatives that benefit society.'
    },
    {
        id: '05',
        title: 'Stay Informed',
        body: 'Stay updated with the latest trends, tools, and technologies through our regular meetups, webinars, and online resources.'
    }
];

const organizers = [
    {
        name: 'Rishi Chaudhari',
        role: 'GDG Lead RVITM',
        photo: rishiImg,
        linkedin: 'https://www.linkedin.com/in/rishi-chaudhari-593148293/'
    },
    {
        name: 'Biswadip Mandal',
        role: 'GDG Organizer RVITM',
        photo: biswaImg,
        linkedin: 'https://www.linkedin.com/in/biswadip-mandal-76b65222b/'
    },
    {
        name: 'M N Aneesh Gupta',
        role: 'GDG Co-Organizer RVITM',
        photo: aneeshImg,
        linkedin: 'https://www.linkedin.com/in/aneesh-gupta-m-n-937792342/'
    },
    {
        name: 'Pratyush Jaiswal',
        role: 'GDG Co-Organizer RVITM',
        photo: pratImg,
        linkedin: 'https://www.linkedin.com/in/pratyush-jaiswal-ba0b6926a/'
    }
];

const connectLinks = [
    {
        label: 'WEBSITE',
        href: 'https://gdg.community.dev/gdg-on-campus-rv-institute-of-technology-and-management-bengaluru-india/'
    },
    {
        label: 'INSTAGRAM',
        href: 'https://www.instagram.com/gdg.rvitm'
    },
    {
        label: 'INSTAGRAM(g-devs)',
        href: 'https://www.instagram.com/googlefordevs/'
    }
];

const AboutScreen = () => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
    };

    const itemVariants = {
        hidden: { y: 22, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <motion.div
            className="relative text-white h-full pb-16"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <div className="absolute -top-24 right-0 w-[420px] h-[420px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-32 left-0 w-[520px] h-[520px] bg-emerald-400/10 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_45%)] pointer-events-none" />

            <motion.section
                variants={itemVariants}
                className="relative bg-black/75 border border-white/10 rounded-sm p-8 md:p-10 shadow-2xl overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent pointer-events-none" />
                <div className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-[2px] w-10 bg-emerald-400" />
                            <span className="heist-mono text-[10px] tracking-[0.4em] uppercase text-emerald-300">ESTABLISHED 2024 // BENGALURU</span>
                        </div>
                        <h1 className="heist-font text-5xl md:text-6xl tracking-widest leading-none">
                            GOOGLE DEVELOPER GROUPS
                            <span className="block text-red-500">RVITM BENGALURU</span>
                        </h1>
                        <p className="heist-mono text-gray-300 text-sm leading-loose mt-6 max-w-2xl">
                            RV Institute of Technology and Management Bengaluru
                        </p>
                        <p className="heist-mono text-gray-400 text-xs leading-loose mt-4 max-w-2xl">
                            Welcome to the Google Developer Groups chapter at RV Institute of Technology and Management in Bengaluru, India!
                        </p>
                        <p className="heist-mono text-gray-400 text-xs leading-loose mt-4 max-w-2xl">
                            Our mission is to foster a vibrant community of tech enthusiasts and aspiring developers. We are dedicated to empowering students with the latest technological skills, providing opportunities to work on exciting projects, and connecting them with industry experts.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-sm heist-mono text-[10px] tracking-[0.3em] uppercase text-gray-300">Community First</span>
                            <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-sm heist-mono text-[10px] tracking-[0.3em] uppercase text-gray-300">Build Together</span>
                            <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-sm heist-mono text-[10px] tracking-[0.3em] uppercase text-gray-300">Learn by Doing</span>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="bg-gradient-to-br from-[#0e1211] via-[#121a16] to-[#0a0f0d] border border-emerald-400/20 rounded-sm p-6 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <span className="heist-mono text-[10px] tracking-[0.3em] uppercase text-emerald-500/80">AUTHORIZED ASSET // GDG-RVITM-01</span>
                                <span className="heist-mono text-[10px] tracking-[0.3em] uppercase text-gray-500">SECURE LINK</span>
                            </div>
                            <div className="mt-6 w-32 h-32 flex items-center justify-center p-4 bg-white/[0.03] border border-emerald-400/20 rounded-sm relative group">
                                <div className="absolute inset-0 border border-emerald-400/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse"></div>
                                <img src={gdg} alt="GDG Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
                            </div>
                            <div className="mt-6 border border-white/10 rounded-sm overflow-hidden">
                                <img
                                    src={rvitmImg}
                                    alt="RV Institute of Technology and Management"
                                    className="w-full h-40 object-cover"
                                />
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 bg-black/70 border border-red-500/40 px-4 py-2 rounded-sm heist-mono text-[10px] tracking-[0.3em] uppercase text-red-400">
                            GDG CHAPTER
                        </div>
                    </div>
                </div>
            </motion.section>

            <motion.section variants={itemVariants} className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-[2px] w-12 bg-red-500" />
                    <span className="heist-mono text-red-400 tracking-[0.4em] uppercase text-xs">WHAT WE OFFER</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {offers.map((offer) => (
                        <div
                            key={offer.id}
                            className="relative bg-black/70 border border-white/10 rounded-sm p-6 shadow-xl overflow-hidden"
                        >
                            <div className="absolute -top-6 -right-4 text-7xl heist-font text-white/5">{offer.id}</div>
                            <div className="text-emerald-300 heist-mono text-[10px] tracking-[0.4em] uppercase">{offer.id}</div>
                            <h3 className="heist-font text-3xl tracking-widest mt-3 mb-3 text-white">{offer.title}</h3>
                            <p className="heist-mono text-gray-400 text-xs leading-loose">{offer.body}</p>
                        </div>
                    ))}
                </div>
            </motion.section>

            <motion.section variants={itemVariants} className="mt-12 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
                <div className="bg-black/70 border border-white/10 rounded-sm p-8 shadow-2xl">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="h-[2px] w-10 bg-emerald-400" />
                        <span className="heist-mono text-emerald-300 tracking-[0.4em] uppercase text-xs">JOIN THE MOVEMENT</span>
                    </div>
                    <h2 className="heist-font text-4xl tracking-widest text-white mb-4">Join the Movement</h2>
                    <p className="heist-mono text-gray-400 text-xs leading-loose">
                        Join us on this exciting journey of learning, collaboration, and innovation. Whether you are a beginner or an experienced developer, there is a place for you here at Google Developer Groups RVITM Bengaluru.
                    </p>
                    <p className="heist-mono text-gray-300 text-xs leading-loose mt-4">
                        We are looking forward to having you as part of our dynamic community. Let us learn, grow, and innovate together.
                    </p>
                </div>

                <div className="bg-gradient-to-br from-[#0b0d0f] via-[#121316] to-[#171117] border border-red-500/30 rounded-sm p-8 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-[2px] w-10 bg-red-500" />
                        <span className="heist-mono text-red-400 tracking-[0.4em] uppercase text-xs">CONNECT WITH US</span>
                    </div>
                    <div className="flex flex-col gap-4">
                        {connectLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center justify-between px-5 py-4 border border-white/10 bg-black/60 rounded-sm hover:border-red-500/60 hover:bg-black/80 transition-colors"
                            >
                                <span className="heist-mono text-[11px] tracking-[0.35em] uppercase text-gray-300 group-hover:text-white">{link.label}</span>
                                <ArrowUpRight size={16} className="text-red-400 group-hover:text-red-300" />
                            </a>
                        ))}
                    </div>
                </div>
            </motion.section>

            <motion.section variants={itemVariants} className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-[2px] w-12 bg-emerald-400" />
                    <span className="heist-mono text-emerald-300 tracking-[0.4em] uppercase text-xs">ORGANIZERS</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {organizers.map((person) => (
                        <div key={person.name} className="bg-black/70 border border-white/10 rounded-sm overflow-hidden shadow-xl">
                            <div className="relative h-56">
                                <img
                                    src={person.photo}
                                    alt={person.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-3 left-3 heist-mono text-[10px] tracking-[0.35em] uppercase text-red-300">
                                    GDG RVITM
                                </div>
                            </div>
                            <div className="p-6">
                                <h3 className="heist-font text-3xl tracking-widest text-white mb-2">{person.name}</h3>
                                <p className="heist-mono text-red-400 text-[10px] tracking-[0.3em] uppercase">{person.role}</p>
                                <div className="mt-5">
                                    <a 
                                        href={person.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block px-4 py-2 border border-white/10 bg-white/5 text-gray-300 heist-mono text-[10px] tracking-[0.3em] uppercase hover:border-red-500/60 hover:text-white transition-colors"
                                    >
                                        VIEW PROFILE
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.section>
        </motion.div>
    );
};

export default AboutScreen;
