import { useState } from 'react';
import { api } from './lib.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/login', { method: 'POST', body: { username, password } });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">GATE <span>Assessment</span></div>
        <h1>Sign in</h1>
        <p className="muted">Use your GATE username — the same one you use for Jira.</p>

        <div className="field" style={{ marginTop: 20 }}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            placeholder="name.surname"
          />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="password">Password</label>
          <div className="input-affix">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button type="button" className="affix-btn" onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn btn-accent btn-block" disabled={busy || !username.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="hint" title="Contact the GATE engineering manager if you cannot sign in.">
          Use your GATE username. After you sign in you only see your own reviews. Scoring and role edits are
          manager-only. If you cannot sign in, ask the engineering manager for a password reset.
        </p>
      </form>
    </div>
  );
}
