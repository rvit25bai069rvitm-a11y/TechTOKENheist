import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { GameStateProvider, useGameState } from './hooks/useGameState';
import { LayoutDashboard, Swords, Crosshair, Settings, LogOut, Clock, Ban, Book, Eye, Zap } from 'lucide-react';
import CountdownOverlay from './components/CountdownOverlay';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import LobbyScreen from './screens/LobbyScreen';
import ArenaScreen from './screens/ArenaScreen';
import BattleScreen from './screens/BattleScreen';
import AdminScreen from './screens/AdminScreen';
import RulebookScreen from './screens/RulebookScreen';


const PlayerTopBar = () => {
  const { gameTimer, gameState } = useGameState();
  
  return (
    <div className="flex-col" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
      {/* Phase Banner */}
      {gameState.phase === 'phase2' && (
        <div className="flex items-center justify-center gap-2 font-heading" style={{ padding: '8px 32px', background: 'rgba(255, 95, 143, 0.12)', borderBottom: '1px solid var(--accent-magenta)', color: 'var(--accent-magenta)', fontSize: '1.1rem', letterSpacing: '2px' }}>
          🔥 PHASE 2 — WAGER MODE ACTIVE
        </div>
      )}
      <div className="panel flex items-center justify-between" style={{ padding: '16px 32px', borderRadius: 0, borderBottom: '1px solid var(--border-subtle)', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="flex items-center gap-4">
          <h2 className="font-heading text-survival" style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '2px' }}>
            {gameState.isGameActive ? 'BIO-HAZARD EVENT LIVE' : gameState.isPaused ? 'CONTAINMENT PAUSED' : 'AWAITING COMMAND AUTH'}
          </h2>
          {(gameState.isGameActive || gameState.isPaused) && (
            <div className={`badge ${gameState.isPaused ? 'badge-warning' : 'badge-survival'}`} style={{ fontSize: '1.2rem' }}>
              <Clock size={16} /> {gameTimer} {gameState.isPaused && '⏸'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className={`badge ${gameState.phase === 'phase2' ? 'badge-magenta' : 'badge-cyan'}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            <Zap size={14} /> {gameState.phase === 'phase2' ? 'PHASE 2' : 'PHASE 1'}
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayerSidebar = () => {
  const location = useLocation();
  const { user, myTeam, logout } = useGameState();

  const isEliminated = myTeam?.status === 'eliminated';

  return (
    <div className="panel flex-col" style={{ width: '280px', height: '100vh', position: 'sticky', top: 0, padding: '32px 24px', borderRight: '1px solid var(--border-subtle)', borderRadius: 0, zIndex: 10, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
      {/* Brand */}
      <div className="flex items-center gap-4 mb-12">
        <div style={{ width: '48px', height: '48px', background: 'var(--accent-survival)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900', fontSize: '24px' }} className="font-heading">
          TH
        </div>
        <div>
          <h1 className="font-heading" style={{ margin: 0, fontSize: '24px' }}>BIO-HAZARD</h1>
          <h1 className="font-heading text-danger" style={{ margin: 0, fontSize: '24px' }}>COMMAND</h1>
        </div>
      </div>

      {/* Operative Info */}
      <div className="mb-8 p-4 card" style={{ borderColor: isEliminated ? 'var(--accent-danger)' : 'var(--border-subtle)' }}>
        <div className="text-muted font-mono" style={{ fontSize: '10px', marginBottom: '4px' }}>OPERATIVE ID</div>
        <div className="font-heading" style={{ fontSize: '20px', marginBottom: '12px', color: isEliminated ? 'var(--accent-danger)' : 'inherit' }}>{myTeam?.name || 'GUEST'}</div>
        
        {isEliminated ? (
          <div className="badge badge-danger w-full flex justify-center py-2">
            <Ban size={14} style={{ marginRight: '6px' }} /> ELIMINATED
          </div>
        ) : user?.role === 'admin' ? (
          <div className="badge badge-warning w-full flex justify-center py-2">
            <Eye size={14} style={{ marginRight: '6px' }} /> SPECTATOR
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-muted font-mono" style={{ fontSize: '10px' }}>TOKENS</div>
            <div className="badge badge-survival">{myTeam?.tokens || 0} TKN</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="text-muted font-mono" style={{ fontSize: '10px', marginBottom: '12px' }}>CONTROL MAP</div>
      <div className="flex-col gap-2 flex-grow">
        <Link to="/lobby" className={`btn ${location.pathname === '/lobby' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
          <LayoutDashboard size={18} /> LOBBY
        </Link>
        <Link to="/arena" className={`btn ${location.pathname === '/arena' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
          <Swords size={18} /> ARENA
        </Link>
        <Link to="/battle" className={`btn ${location.pathname === '/battle' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
          <Crosshair size={18} /> BATTLE
        </Link>
        <Link to="/rulebook" className={`btn ${location.pathname === '/rulebook' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
          <Book size={18} /> RULEBOOK
        </Link>
      </div>

      {/* Logout */}
      <div className="mt-auto pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {user?.role === 'admin' && (
          <Link to="/admin" className="btn btn-warning w-full" style={{ justifyContent: 'center', marginBottom: '10px' }}>
            <Settings size={16} /> EXIT SPECTATOR
          </Link>
        )}
        <button className="btn btn-ghost w-full" style={{ justifyContent: 'center', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }} onClick={logout}>
          <LogOut size={16} /> DISCONNECT
        </button>
      </div>
    </div>
  );
};

const AdminLayout = ({ children }) => {
  const { logout, gameState } = useGameState();
  return (
    <div className="flex-col min-h-screen">
      <nav className="panel flex items-center justify-between" style={{ padding: '16px 32px', borderRadius: 0, borderBottom: '1px solid var(--accent-danger)', zIndex: 10 }}>
        <div className="flex items-center gap-6">
          <div style={{ width: '48px', height: '48px', background: 'var(--accent-danger)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '900', fontSize: '24px' }}>
            ⚙
          </div>
          <div>
            <h1 className="font-heading text-danger" style={{ margin: 0, fontSize: '24px', letterSpacing: '2px' }}>COMMANDER</h1>
            <h1 className="font-mono text-muted" style={{ margin: 0, fontSize: '10px', letterSpacing: '4px' }}>BIO-HAZARD OPS</h1>
          </div>
        </div>
        
        {/* Admin Phase + Logout */}
        <div className="flex items-center gap-8">
          <div className={`badge ${gameState.phase === 'phase2' ? 'badge-magenta' : 'badge-cyan'}`} style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
            <Zap size={14} style={{ marginRight: '4px' }} />
            {gameState.phase === 'phase2' ? 'PHASE 2 — WAGER' : 'PHASE 1 — STANDARD'}
          </div>

          <button className="btn btn-ghost" style={{ borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }} onClick={logout}>
            <LogOut size={16} /> DISCONNECT
          </button>
        </div>
      </nav>
      <div className="p-8" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {children}
      </div>
    </div>
  );
};

const PlayerLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen">
      <PlayerSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PlayerTopBar />
        <div style={{ padding: '40px 64px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, countdown } = useGameState();

  return (
    <>
      <CountdownOverlay count={countdown} />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingScreen />} />
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/lobby'} /> : <LoginScreen />} />

        {/* Player Routes */}
        <Route path="/lobby" element={
          user ? <PlayerLayout><LobbyScreen /></PlayerLayout> : <Navigate to="/login" />
        } />
        <Route path="/arena" element={
          user ? <PlayerLayout><ArenaScreen /></PlayerLayout> : <Navigate to="/login" />
        } />
        <Route path="/battle" element={
          user ? <PlayerLayout><BattleScreen /></PlayerLayout> : <Navigate to="/login" />
        } />
        <Route path="/rulebook" element={
          user ? <PlayerLayout><RulebookScreen /></PlayerLayout> : <Navigate to="/login" />
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
          user && user.role === 'admin' ? <AdminLayout><AdminScreen /></AdminLayout> : <Navigate to="/login" />
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
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
