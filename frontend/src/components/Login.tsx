import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/AuthCustom.css'; // Direct path to our new styles

interface LoginProps {
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-login-container">
      <div className="custom-login-card">
        
        {/* Branding Headers */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            background: '#A4DE02', color: '#1E5631', width: '36px', height: '36px',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '14px', margin: '0 auto 12px auto'
          }}>
            NJ
          </div>
          <h1 style={{ fontSize: '22px', color: '#A4DE02', fontWeight: 600, margin: 0 }}>
            NurseJK Assistant
          </h1>
          <p style={{ fontSize: '13px', color: '#FFFFFF', opacity: 0.7, marginTop: '4px' }}>
            Clinical Engine Gateway
          </p>
        </div>

        {error && <div style={{ color: '#EF4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>}

        {/* Input Form Structure */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="custom-field-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="custom-field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="custom-login-btn">
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Switch Links */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#FFFFFF', opacity: 0.8, margin: 0 }}>
          New student?{' '}
          <button 
            type="button" 
            onClick={onSwitchToRegister} 
            style={{ background: 'none', border: 'none', color: '#A4DE02', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', padding: 0 }}
          >
            Register here
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;