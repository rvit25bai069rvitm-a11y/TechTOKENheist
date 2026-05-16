import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { GameStateProvider, useGameState } from './hooks/useGameState';
import { LayoutDashboard, Swords, Crosshair, Book, Eye, Zap, VenetianMask, Users } from 'lucide-react';
import CountdownOverlay from './components/CountdownOverlay';
import MatchStartOverlay from './components/MatchStartOverlay';
import FinaleOverlay from './components/FinaleOverlay';
import gdgLogo from '../assets/gdg.png';

import './PlayerLayout.css';

const LandingScreen = lazy(() => import('./screens/LandingScreen'));
const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const LobbyScreen = lazy(() => import('./screens/LobbyScreen'));
const ArenaScreen = lazy(() => import('./screens/ArenaScreen'));
const BattleScreen = lazy(() => import('./screens/BattleScreen'));
const AdminScreen = lazy(() => import('./screens/AdminScreen'));
const RulebookScreen = lazy(() => import('./screens/RulebookScreen'));
const AboutScreen = lazy(() => import('./screens/AboutScreen'));
const DevsScreen = lazy(() => import('./screens/DevsScreen'));

const PlayerTopBar = () => {
  const { myTeam, logout, gameTimer } = useGameState();
  const teamName = myTeam?.name || 'GUEST';
  const isEliminated = myTeam?.status === 'eliminated';

  return (
    <div className="player-top-bar">
      <div className="top-bar-brand">
        <div className="mask-icon-container">
          <VenetianMask size={24} className="text-white" />
        </div>
        <div className="brand-text">
          <h1>THE PROFESSOR'S COMMAND CENTER</h1>
          <div className="flex items-center gap-2">
            <p className="m-0">ROYAL MINT OPERATIONS — {isEliminated ? 'TERMINATED' : 'ACTIVE'}</p>
            <span className="w-1 h-1 bg-white/30 rounded-full"></span>
            <div className="flex items-center gap-1 opacity-60">
              <img src={gdgLogo} alt="GDG" className="h-3 w-auto object-contain brightness-0 invert" />
              <span className="heist-mono text-[8px] tracking-tighter">RVITM</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end border-r border-white/10 pr-6">
          <span className="heist-mono text-gray-500 text-[10px] tracking-widest uppercase mb-1">OPERATIVE ID</span>
          <span className={`heist-font text-2xl tracking-widest leading-none ${isEliminated ? 'text-red-500 line-through' : 'text-white'}`}>{teamName}</span>
        </div>

        <div className="flex items-center gap-3 bg-black/50 border border-white/10 px-4 py-2">
          <span className="heist-mono text-gray-500 text-[10px] uppercase tracking-widest">FUNDS</span>
          <span className="heist-font text-red-500 text-2xl tracking-widest">{myTeam?.tokens || 0}</span>
          <span className="heist-font text-white text-xl">TKN</span>
        </div>

        <div className="mission-timer">
          <span className="timer-label">MISSION TIMER</span>
          <span className="timer-value tabular-nums">{gameTimer}</span>
        </div>

        <button className="abort-btn" onClick={logout}>
          ABORT MISSION
        </button>
      </div>
    </div>
  );
};

const PlayerSidebar = () => {
  const location = useLocation();

  const navLinks = [
    { path: '/lobby', label: 'LOBBY', icon: LayoutDashboard },
    { path: '/arena', label: 'ARENA', icon: Swords },
    { path: '/battle', label: 'BATTLE', icon: Crosshair },
    { path: '/rulebook', label: 'THE PLAN', icon: Book },
    { path: '/about', label: 'ABOUT', icon: Eye },
    { path: '/devs', label: 'DEVELOPERS', icon: Users },
  ];

  return (
    <div className="player-sidebar">
      <div className="sidebar-nav">
        {navLinks.map((link) => {
          const isActive = location.pathname === link.path;
          const { icon: Icon } = link;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} className="nav-item-icon" />
              <span className="nav-item-label">{link.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="classified-stamp">
        <p>CLASSIFIED</p>
      </div>
    </div>
  );
};

const AdminLayout = ({ children }) => {
  const { logout, gameState, gameTimer } = useGameState();
  return (
    <div className="player-layout-container">
      <nav className="player-top-bar">
        <div className="top-bar-brand">
          <div className="mask-icon-container">
            <VenetianMask size={24} className="text-white" />
          </div>
          <div className="brand-text">
            <h1>EL PROFESOR</h1>
            <div className="flex items-center gap-2">
              <p className="m-0">OPERATION CONTROL TENT — ADMIN ACCESS</p>
              <span className="w-1 h-1 bg-white/30 rounded-full"></span>
              <div className="flex items-center gap-1 opacity-60">
                <img src={gdgLogo} alt="GDG" className="h-3 w-auto object-contain brightness-0 invert" />
                <span className="heist-mono text-[8px] tracking-tighter">RVITM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className={`px-4 py-2 heist-mono text-sm tracking-widest flex items-center gap-2 ${gameState.phase === 'phase2' ? 'bg-heist-red text-white' : 'border border-heist-teal text-heist-teal'}`}>
            <Zap size={14} />
            {gameState.phase === 'phase2' ? 'WAGER MODE' : 'PHASE 1 — STANDARD'}
          </div>

          <div className="mission-timer">
            <span className="timer-label">MISSION TIMER</span>
            <span className="timer-value tabular-nums">{gameTimer}</span>
          </div>

          <button className="abort-btn" onClick={logout}>
            DISCONNECT
          </button>
        </div>
      </nav>
      <div className="player-content-wrapper">
        <div className="player-content-container">
          {children}
        </div>
      </div>
    </div>
  );
};

const PlayerLayout = ({ children }) => {
  const { teams, gameState } = useGameState();
  return (
    <div className="player-layout-container">
      <PlayerTopBar />
      <div className="flex flex-1 relative z-10">
        <PlayerSidebar />
        <div className="player-content-wrapper">
          <div className="player-content-container">
            {children}
          </div>
        </div>
      </div>

      <div className="player-bottom-bar">
        <div className="bottom-stat">
          <span className="stat-label">TOTAL CREW:</span>
          <span className="stat-value">{teams.length}</span>
        </div>
        <div className="bottom-stat">
          <span className="stat-label">PLANS READY:</span>
          <span className="stat-value">5</span>
        </div>
        <div className="bottom-stat">
          <span className="stat-label">ACTIVE MISSIONS:</span>
          <span className="stat-value">3</span>
        </div>
        <div className="bottom-stat">
          <span className="stat-label">PHASE:</span>
          <span className="stat-value uppercase">{gameState.phase}</span>
        </div>
      </div>
    </div>
  );
};


const AppContent = () => {
  const { user, countdown, hasHydrated } = useGameState();

  if (!hasHydrated) return null;

  return (
    <>
      <CountdownOverlay count={countdown} />
      {user?.role !== 'admin' && <MatchStartOverlay />}
      <FinaleOverlay />
      <Suspense fallback={<div className="route-loading" />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingScreen />} />
          <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/lobby'} /> : <LoginScreen />} />
          <Route path="/login.html" element={user ? <Navigate to={user.role === 'admin' ? '/admin.html' : '/lobby.html'} /> : <LoginScreen />} />

          {/* Player Routes */}
          <Route path="/lobby" element={
            user ? <PlayerLayout><LobbyScreen /></PlayerLayout> : <Navigate to="/login" />
          } />
          <Route path="/lobby.html" element={
            user ? <PlayerLayout><LobbyScreen /></PlayerLayout> : <Navigate to="/login.html" />
          } />
          <Route path="/arena" element={
            user ? <PlayerLayout><ArenaScreen /></PlayerLayout> : <Navigate to="/login" />
          } />
          <Route path="/arena.html" element={
            user ? <PlayerLayout><ArenaScreen /></PlayerLayout> : <Navigate to="/login.html" />
          } />
          <Route path="/battle" element={
            user ? <PlayerLayout><BattleScreen /></PlayerLayout> : <Navigate to="/login" />
          } />
          <Route path="/battle.html" element={
            user ? <PlayerLayout><BattleScreen /></PlayerLayout> : <Navigate to="/login.html" />
          } />
          <Route path="/rulebook" element={
            user ? <PlayerLayout><RulebookScreen /></PlayerLayout> : <Navigate to="/login" />
          } />
          <Route path="/rulebook.html" element={
            user ? <PlayerLayout><RulebookScreen /></PlayerLayout> : <Navigate to="/login.html" />
          } />
          <Route path="/about" element={
            user ? <PlayerLayout><AboutScreen /></PlayerLayout> : <Navigate to="/login" />
          } />
          <Route path="/about.html" element={
            user ? <PlayerLayout><AboutScreen /></PlayerLayout> : <Navigate to="/login.html" />
          } />
          <Route path="/devs" element={
            user ? <PlayerLayout><DevsScreen /></PlayerLayout> : <Navigate to="/login" />
          } />
          <Route path="/devs.html" element={
            user ? <PlayerLayout><DevsScreen /></PlayerLayout> : <Navigate to="/login.html" />
          } />

          {/* Admin Routes */}
          <Route path="/admin" element={
            user && user.role === 'admin' ? <AdminLayout><AdminScreen /></AdminLayout> : <Navigate to="/login" />
          } />
          <Route path="/admin.html" element={
            user && user.role === 'admin' ? <AdminLayout><AdminScreen /></AdminLayout> : <Navigate to="/login.html" />
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </>
  );
};

function App() {
  return (
    <GameStateProvider>
      <Router>
        <AppContent />
      </Router>
    </GameStateProvider>
  );
}

export default App;
