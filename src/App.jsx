import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { GameStateProvider, useGameState } from './hooks/useGameState';
import { LayoutDashboard, Swords, Crosshair, Settings, LogOut, Clock, Ban, Book, Eye, Zap, VenetianMask } from 'lucide-react';
import CountdownOverlay from './components/CountdownOverlay';
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import LobbyScreen from './screens/LobbyScreen';
import ArenaScreen from './screens/ArenaScreen';
import BattleScreen from './screens/BattleScreen';
import AdminScreen from './screens/AdminScreen';
import RulebookScreen from './screens/RulebookScreen';
import { getProfileAvatar, getProfileLabel } from './data/profileAvatars';

const PlayerTopBar = () => {
  const { gameTimer, gameState } = useGameState();

  return (
    <div className="flex flex-col sticky top-0 z-20 shadow-xl">
      {/* Phase Banner */}
      {gameState.phase === 'phase2' && (
        <div className="flex items-center justify-center gap-2 heist-font px-8 py-2 bg-red-900 bg-opacity-30 border-b border-heist-red text-heist-red text-xl tracking-widest">
          🔥 PHASE 2 — WAGER MODE ACTIVE
        </div>
      )}
      <div className="bg-black bg-opacity-90 border-b-2 border-gray-800 p-4 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="heist-font text-white m-0 text-3xl tracking-widest">
            {gameState.isGameActive ? 'HEIST INFILTRATION LIVE' : gameState.isPaused ? 'OPERATION PAUSED' : 'AWAITING EL PROFESOR'}
          </h2>
          {(gameState.isGameActive || gameState.isPaused) && (
            <div className={`px-4 py-1 border ${gameState.isPaused ? 'border-heist-yellow text-heist-yellow' : 'border-heist-teal text-heist-teal'} heist-mono text-xl flex items-center gap-2`}>
              <Clock size={18} /> {gameTimer} {gameState.isPaused && '⏸'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className={`px-4 py-1 border ${gameState.phase === 'phase2' ? 'border-heist-red bg-heist-red text-white' : 'border-heist-yellow text-heist-yellow'} heist-mono text-sm tracking-widest flex items-center gap-2`}>
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
    <div className="w-[280px] h-screen sticky top-0 p-6 flex flex-col bg-black border-r-2 border-gray-800 z-10 shadow-2xl relative overflow-hidden">
      {/* Blueprint background lines */}
      <div className="absolute inset-0 bg-blueprint opacity-10 pointer-events-none"></div>

      {/* Brand */}
      <div className="flex items-center gap-4 mb-10 relative z-10 mt-4">
        <div className="w-12 h-12 bg-heist-red rounded-none flex items-center justify-center text-white border-2 border-heist-red shadow-[0_0_15px_rgba(211,47,47,0.6)]">
          <VenetianMask size={28} />
        </div>
        <div>
          <h1 className="heist-font text-white m-0 text-3xl tracking-widest">THE HEIST</h1>
          <h1 className="heist-font text-heist-red m-0 text-3xl tracking-widest">LA BANDA</h1>
        </div>
      </div>

      {/* Operative Info */}
      <div className={`mb-8 p-4 border-2 ${isEliminated ? 'border-heist-red bg-red-900 bg-opacity-20' : 'border-gray-800 bg-black bg-opacity-60'} relative z-10`}>
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-heist-teal mb-3 shadow-[0_0_18px_rgba(77,182,172,0.3)] bg-black">
          <img src={myTeam?.avatarSrc || getProfileAvatar(myTeam?.name)} alt={myTeam?.name ? getProfileLabel(myTeam.name) : 'Operative Avatar'} className="w-full h-full object-cover" />
        </div>
        <div className="heist-mono text-gray-500 text-[10px] mb-1 uppercase tracking-widest">OPERATIVE ID</div>
        <div className={`heist-font text-2xl mb-3 truncate ${isEliminated ? 'text-heist-red line-through' : 'text-white'}`}>{myTeam?.name || 'GUEST RECRUIT'}</div>

        {isEliminated ? (
          <div className="bg-heist-red text-white w-full flex justify-center py-2 heist-mono text-xs tracking-widest border border-white">
            <Ban size={14} className="mr-2" /> ELIMINATED
          </div>
        ) : user?.role === 'admin' ? (
          <div className="border border-heist-yellow text-heist-yellow w-full flex justify-center py-2 heist-mono text-xs tracking-widest">
            <Eye size={14} className="mr-2" /> SPECTATOR
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-gray-800 pt-3 mt-2">
            <div className="heist-mono text-gray-500 text-[10px] tracking-widest">CURRENT LOOT</div>
            <div className="text-heist-yellow heist-font text-2xl border-b border-heist-yellow px-1">{myTeam?.tokens || 0} TKN</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="heist-mono text-gray-500 text-[10px] mb-3 uppercase tracking-widest relative z-10">CONTROL MAP</div>
      <div className="flex flex-col gap-3 flex-grow relative z-10">
        <Link to="/lobby" className={`flex items-center gap-3 px-4 py-3 heist-font text-xl tracking-widest transition-colors ${location.pathname === '/lobby' ? 'bg-heist-red text-white border-l-4 border-white' : 'text-gray-400 hover:text-white hover:bg-gray-900 border-l-4 border-transparent'}`}>
          <LayoutDashboard size={20} /> BRIEFING ROOM
        </Link>
        <Link to="/arena" className={`flex items-center gap-3 px-4 py-3 heist-font text-xl tracking-widest transition-colors ${location.pathname === '/arena' ? 'bg-heist-red text-white border-l-4 border-white' : 'text-gray-400 hover:text-white hover:bg-gray-900 border-l-4 border-transparent'}`}>
          <Swords size={20} /> ARENA
        </Link>
        <Link to="/battle" className={`flex items-center gap-3 px-4 py-3 heist-font text-xl tracking-widest transition-colors ${location.pathname === '/battle' ? 'bg-heist-red text-white border-l-4 border-white' : 'text-gray-400 hover:text-white hover:bg-gray-900 border-l-4 border-transparent'}`}>
          <Crosshair size={20} /> INFILTRATION
        </Link>
        <Link to="/rulebook" className={`flex items-center gap-3 px-4 py-3 heist-font text-xl tracking-widest transition-colors ${location.pathname === '/rulebook' ? 'bg-heist-red text-white border-l-4 border-white' : 'text-gray-400 hover:text-white hover:bg-gray-900 border-l-4 border-transparent'}`}>
          <Book size={20} /> THE PLAN (RULES)
        </Link>
      </div>

      {/* Logout */}
      <div className="mt-auto pt-6 border-t-2 border-gray-800 relative z-10">
        {user?.role === 'admin' && (
          <Link to="/admin" className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-heist-yellow text-heist-yellow hover:bg-heist-yellow hover:text-black mb-3 heist-font text-xl tracking-widest transition-colors">
            <Settings size={18} /> BACK TO TENT
          </Link>
        )}
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-600 text-gray-400 hover:border-heist-red hover:text-heist-red heist-font text-xl tracking-widest transition-colors" onClick={logout}>
          <LogOut size={18} /> FLEE
        </button>
      </div>
    </div>
  );
};

const AdminLayout = ({ children }) => {
  const { logout, gameState } = useGameState();
  return (
    <div className="flex flex-col min-h-screen heist-bg text-white">
      <nav className="bg-black bg-opacity-90 border-b-2 border-heist-red p-4 px-8 flex items-center justify-between z-20 shadow-[0_4px_20px_rgba(211,47,47,0.2)]">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 bg-heist-red text-white flex items-center justify-center border-2 border-heist-red shadow-[0_0_15px_rgba(211,47,47,0.8)]">
            <VenetianMask size={28} />
          </div>
          <div>
            <h1 className="heist-font text-heist-red m-0 text-3xl tracking-widest">EL PROFESOR</h1>
            <h1 className="heist-mono text-gray-500 m-0 text-[10px] tracking-widest uppercase">OPERATION CONTROL TENT</h1>
          </div>
        </div>

        {/* Admin Phase + Logout */}
        <div className="flex items-center gap-8">
          <div className={`px-4 py-2 heist-mono text-sm tracking-widest flex items-center gap-2 ${gameState.phase === 'phase2' ? 'bg-heist-red text-white' : 'border border-heist-teal text-heist-teal'}`}>
            <Zap size={14} />
            {gameState.phase === 'phase2' ? 'PHASE 2 — WAGER' : 'PHASE 1 — STANDARD'}
          </div>

          <button className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-400 hover:border-heist-red hover:text-heist-red heist-font text-xl tracking-widest transition-colors" onClick={logout}>
            <LogOut size={16} /> DISCONNECT
          </button>
        </div>
      </nav>
      <div className="p-8 w-full max-w-[1400px] mx-auto">
        {children}
      </div>
    </div>
  );
};

const PlayerLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen heist-bg">
      <PlayerSidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Faint global background grid */}
        <div className="absolute inset-0 bg-blueprint opacity-5 pointer-events-none z-0"></div>
        <PlayerTopBar />
        <div className="p-6 md:p-10 w-full max-w-[1200px] mx-auto relative z-10 pb-24">
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
