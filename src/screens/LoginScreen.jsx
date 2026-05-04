import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import { Lock, ArrowLeft } from 'lucide-react';

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
      const result = await login(username, password);
      if (result.success) {
        if (result.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/lobby');
        }
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Is the server running?');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="glass-panel login-card">
        {/* Back button */}
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/')}
          style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta))',
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', fontWeight: '900', color: '#000'
          }}>
            TH
          </div>
        </div>

        <h1 className="text-gradient" style={{ fontSize: '1.5rem' }}>Enter the Command Grid</h1>
        <p className="login-subtitle">Authenticate as survivor squad or command admin</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="flex-col gap-4">
          <div className="flex-col gap-1">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </label>
            <input
              type="text"
              className="input"
              placeholder="Team Name or Admin ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex-col gap-1">
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.85rem' }}
          >
            <Lock size={16} />
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
          <p>Players: Use your team name as username</p>
          <p>Admin: Use the admin credentials provided</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
