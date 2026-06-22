import React, { useState } from 'react';
import API_BASE from '../api';
import '../styles/AuthCustom.css';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export default function Login({ onSwitchToRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(false);

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      // Crucial Step: Store the token so App.tsx detects authentication instantly
      if (data.token) {
        localStorage.setItem('token', data.token);
        // Force a state re-evaluation to load the dashboard shell smoothly
        window.location.reload();
      } else {
        throw new Error('No authentication token returned from engine backend.');
      }
    } catch (err: unknown) {
      console.error('🔥 Login Submission Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to reach the authentication engine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-login-container">
      <div className="custom-login-card">
        <div style={{ textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 12px auto', width: '45px', height: '45px', fontSize: '18px' }}>NJ</div>
          <h2 className="brand-title" style={{ color: '#a3e635', margin: '0' }}>NurseJK Assistant</h2>
          <p className="brand-subtitle" style={{ color: '#ccc', fontSize: '13px', marginTop: '4px' }}>Clinical Engine Gateway</p>
        </div>

        {error && <div className="auth-error-banner" style={{ color: '#ff4d4f', textAlign: 'center', margin: '10px 0', fontSize: '13px', fontWeight: 'bold' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '15px' }}>
          <div className="custom-field-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="Enter your email"
            />
          </div>

          <div className="custom-field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="custom-login-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '15px 0 0 0' }}>
          New student?{' '}
          <button type="button" onClick={onSwitchToRegister} style={{ background: 'none', border: 'none', color: '#a3e635', cursor: 'pointer', textDecoration: 'underline', padding: '0', fontSize: '12px' }}>
            Register here
          </button>
        </p>
      </div>
    </div>
  );
}