import { useEffect, useState } from 'react';
import AdminRoles from './AdminRoles.jsx';
import Assessment from './Assessment.jsx';
import Login from './Login.jsx';
import { api } from './lib.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [page, setPage] = useState('assess');
  const [error, setError] = useState('');

  async function loadCatalog() {
    const data = await api('/api/catalog');
    setCatalog(data);
  }

  useEffect(() => {
    api('/api/me')
      .then(async (data) => {
        setUser(data.user);
        await loadCatalog();
      })
      .catch(() => setUser(false));
  }, []);

  if (user === null) {
    return <div className="login-wrap"><p className="muted">Loading…</p></div>;
  }

  if (!user) {
    return (
      <Login
        onLogin={async (next) => {
          setUser(next);
          await loadCatalog();
        }}
      />
    );
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' });
    setUser(false);
    setCatalog(null);
    setPage('assess');
  }

  if (!catalog) {
    return <div className="login-wrap">{error || 'Loading catalog…'}</div>;
  }

  if (page === 'admin' && user.access === 'admin') {
    return (
      <div className="app">
        <header className="topbar">
          <div className="topbar-logo">GATE <span>Assessment</span></div>
          <div className="topbar-spacer" />
          <span className="badge badge-admin">Admin</span>
          <button className="btn btn-plain" onClick={logout}>Sign out</button>
        </header>
        <AdminRoles
          catalog={catalog}
          onClose={() => setPage('assess')}
          onSaved={async () => {
            try {
              await loadCatalog();
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      </div>
    );
  }

  return (
    <Assessment
      user={user}
      catalog={catalog}
      onRefreshCatalog={loadCatalog}
      onOpenAdmin={() => setPage('admin')}
      onLogout={logout}
    />
  );
}
