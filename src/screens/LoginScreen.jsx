import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { Lock, ArrowLeft } from 'lucide-react';
import './LoginScreen.css';

const LoginScreen = () => {
  const navigate = useNavigate();
  const { login } = useGameState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log(`Attempting login for: ${username.trim()}`);
      const result = await login(username.trim(), password);
      console.log('Login result:', result);
      
      if (result.success) {
        if (result.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/lobby');
        }
      } else {
        setError(result.error || 'Access Denied');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection to The Professor lost.');
    }
    setLoading(false);
  };

  return (
    <div className="money-heist-login-viewport font-body-md bg-[#1f0f0e] text-white selection:bg-red-900 selection:text-white">
      <main className="w-full flex min-h-screen overflow-hidden">
        {/* Left Column: Dramatic Background (Tactical Image) */}
        <section className="hidden lg:flex lg:w-2/3 xl:w-3/4 relative overflow-hidden flex-col justify-end login-image-side">
          {/* Background Image and Overlays via CSS */}
          <div className="absolute inset-0 z-0 bg-vault-image"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1f0f0e] via-[#1f0f0e]/80 to-[#c1121f]/20 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:100%_4px] pointer-events-none"></div>

          {/* Foreground decorative elements */}
          <div className="relative z-10 p-12 flex flex-col items-start text-left">
            <div className="bg-[#1f0f0e]/80 border border-white/10 p-6 shadow-[4px_4px_0px_rgba(0,0,0,0.6)] backdrop-blur-sm max-w-md">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(255,0,0,0.8)]"></div>
                <h3 className="heist-mono text-[10px] text-yellow-500 uppercase tracking-[0.3em]">SYSTEM STATUS: LOCKDOWN</h3>
              </div>
              <p className="heist-mono text-[10px] text-gray-500 leading-loose uppercase tracking-widest">
                &gt; SECURE TUNNEL ESTABLISHED.<br/>
                &gt; AWAITING OPERATIVE AUTHENTICATION.<br/>
                &gt; UNAUTHORIZED ACCESS WILL TRIGGER ALARMS.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Login Container (Entry Module) */}
        <section className="w-full lg:w-1/3 xl:w-1/4 bg-[#2c1b1a] flex flex-col justify-between border-l border-white/5 z-10 shadow-[-8px_0px_0px_rgba(0,0,0,0.6)]">
          {/* Top Branding */}
          <div className="px-8 py-10 border-b border-white/5 relative overflow-hidden bg-[#190a09]">
             <div className="login-blueprint-overlay"></div>
             <button
              className="heist-back-btn mb-10 flex items-center gap-2 text-[10px] text-gray-500 hover:text-red-500 transition-colors uppercase tracking-[0.2em] heist-mono"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={14} /> RETREAT
            </button>
            <h1 className="heist-font text-5xl font-bold tracking-tighter text-red-600 uppercase leading-none mb-2">
              HEIST_OS <span className="text-yellow-500">v1.0</span>
            </h1>
            <p className="heist-mono text-[10px] text-gray-600 tracking-[0.3em] uppercase">Encrypted Link Established</p>
          </div>

          {/* Login Form Area */}
          <div className="px-8 py-12 flex-grow flex flex-col justify-center">
            <div className="mb-10">
              <h2 className="heist-font text-3xl font-bold text-red-600 uppercase tracking-tight mb-2">ENTRY PROTOCOL</h2>
              <p className="heist-mono text-[10px] text-gray-500 uppercase tracking-widest">Authenticate to access Command Center.</p>
            </div>

            {error && (
              <div className="mb-6 border-l-2 border-red-600 bg-red-600 bg-opacity-10 p-4 heist-mono text-[10px] text-red-500 uppercase tracking-widest leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Operative ID Field */}
              <div className="flex flex-col gap-3">
                <label className="heist-mono text-[10px] text-gray-400 uppercase tracking-[0.2em]" htmlFor="username">Operative ID</label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    className="w-full bg-[#1a0a09] border border-white/5 text-white heist-mono text-sm py-4 px-5 focus:outline-none focus:border-yellow-500 transition-all placeholder:text-gray-800"
                    placeholder="e.g. TOKYO"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Security Key Field */}
              <div className="flex flex-col gap-3">
                <label className="heist-mono text-[10px] text-gray-400 uppercase tracking-[0.2em]" htmlFor="password">Security Key</label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    className="w-full bg-[#1a0a09] border border-white/5 text-white heist-mono text-sm py-4 px-5 focus:outline-none focus:border-yellow-500 transition-all placeholder:text-gray-800"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-700 text-white heist-font text-xl font-bold uppercase py-5 px-6 flex items-center justify-center gap-4 border border-transparent hover:bg-red-600 hover:border-yellow-500 shadow-[4px_4px_0px_rgba(0,0,0,0.6)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-[2px_2px_0px_rgba(0,0,0,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <span>{loading ? 'BREACHING...' : 'INITIATE BREACH'}</span>
                  <Lock size={20} className="group-hover:animate-pulse" />
                </button>
              </div>
            </form>

            {/* Help Link */}
            <div className="mt-10 pt-8 border-t border-white/5 text-center">
              <a 
                href="#" 
                className="heist-mono text-[9px] text-gray-600 hover:text-yellow-500 hover:underline transition-colors tracking-[0.3em] uppercase block leading-relaxed"
                onClick={(e) => e.preventDefault()}
              >
                FORGOTTEN CREDENTIALS?<br/>CONTACT THE PROFESSOR.
              </a>
            </div>
          </div>

          {/* Footer Area */}
          <div className="px-8 py-6 border-t border-white/5 bg-[#190a09]">
            <p className="heist-mono text-[9px] text-gray-700 tracking-[0.4em] uppercase text-center opacity-70">
              © 2024 ROYAL MINT INFRASTRUCTURE
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LoginScreen;
