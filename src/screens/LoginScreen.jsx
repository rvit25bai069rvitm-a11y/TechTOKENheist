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
      const result = await login(username, password);
      if (result.success) {
        if (result.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/lobby');
        }
      } else {
        setError(result.error || 'Access Denied');
      }
    } catch {
      setError('Connection to The Professor lost.');
    }
    setLoading(false);
  };

  return (
    <div className="money-heist-bg">
      <div className="heist-panel">
        <button
          className="heist-back-btn"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={16} /> Retreat
        </button>

        <div style={{ textAlign: 'center' }}>
          <div className="heist-mask-icon"></div>

          <h1 className="heist-title">Enter The Vault</h1>
          <p className="heist-subtitle">Identify your alias. The Resistance needs you.</p>
        </div>

        {error && <div className="login-error" style={{ borderColor: '#ff1a1a', background: 'rgba(255, 0, 0, 0.1)', color: '#ff6666' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="heist-input-group">
            <label className="heist-label">
              Profile Name / Professor ID
            </label>
            <input
              type="text"
              className="heist-input"
              placeholder="e.g. tokyo, berlin, alicia"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="heist-input-group">
            <label className="heist-label">
              Access Code
            </label>
            <input
              type="password"
              className="heist-input"
              placeholder="Enter secure code"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="heist-btn"
            disabled={loading}
          >
            <Lock size={18} />
            {loading ? 'BREACHING SYSTEM...' : 'BREACH VAULT'}
          </button>
        </form>

        <div className="heist-footer-text">
          <p>Recruits: Enter your assigned <span>Profile Name</span></p>
          <p>Professor: Use your secure <span>Override Credentials</span></p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
