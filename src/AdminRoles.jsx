import { useMemo, useState } from 'react';
import { api } from './lib.js';

const EMPTY_METRIC = () => ({
  id: `m-${Date.now()}`,
  title: '',
  description: '',
  levels: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' },
});

export default function AdminRoles({ catalog, onClose, onSaved }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const form = editing;

  function startNew() {
    setEditing({
      id: null,
      label: '',
      icon: '●',
      slug: '',
      metrics: [EMPTY_METRIC()],
    });
  }

  function startEdit(role) {
    setEditing(JSON.parse(JSON.stringify(role)));
  }

  function updateMetric(i, patch) {
    setEditing((prev) => {
      const metrics = prev.metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
      return { ...prev, metrics };
    });
  }

  function updateLevel(i, level, value) {
    setEditing((prev) => {
      const metrics = prev.metrics.map((m, idx) =>
        idx === i ? { ...m, levels: { ...m.levels, [level]: value } } : m,
      );
      return { ...prev, metrics };
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const payload = {
        label: form.label,
        icon: form.icon,
        slug: form.slug,
        metrics: form.metrics.filter((m) => m.title.trim()),
      };
      if (form.id) await api(`/api/roles/${form.id}`, { method: 'PUT', body: payload });
      else await api('/api/roles', { method: 'POST', body: payload });
      setEditing(null);
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(role) {
    if (!confirm(`Delete role “${role.label}”?`)) return;
    await api(`/api/roles/${role.id}`, { method: 'DELETE' });
    await onSaved();
  }

  const canSave = useMemo(() => form && form.label.trim() && form.metrics.some((m) => m.title.trim()), [form]);

  return (
    <div className="main">
      <div className="page-head" style={{ paddingTop: 8 }}>
        <div>
          <h1>Roles &amp; metrics</h1>
          <p className="page-sub">Shared tracks used by every review.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-plain" onClick={onClose}>Back to assessment</button>
          <button className="btn btn-accent" onClick={startNew}>Add role</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {!form && (
        <div className="card">
          <h2>Roles</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Technical skill tracks. Shared domains (Agile, Soft Skills, Delivery, Growth) stay the same for every role.
          </p>
          <div className="admin-list">
            {catalog.roles.map((role) => (
              <div className="admin-row" key={role.id}>
                <div>
                  <strong>{role.icon} {role.label}</strong>
                  <div className="muted">{role.metrics.length} technical metrics</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => startEdit(role)}>Edit</button>
                  <button className="btn btn-danger" onClick={() => remove(role)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div className="card">
          <h2>{form.id ? 'Edit role' : 'New role'}</h2>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Name</label>
            <input value={form.label} onChange={(e) => setEditing({ ...form, label: e.target.value })} />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Icon</label>
            <input value={form.icon} onChange={(e) => setEditing({ ...form, icon: e.target.value })} maxLength={4} />
          </div>
          <div className="field" style={{ marginTop: 12, marginBottom: 16 }}>
            <label>Slug (optional)</label>
            <input value={form.slug || ''} onChange={(e) => setEditing({ ...form, slug: e.target.value })} />
          </div>

          {form.metrics.map((metric, i) => (
            <div className="metric-editor" key={metric.id || i}>
              <div className="field">
                <label>Metric title</label>
                <input value={metric.title} onChange={(e) => updateMetric(i, { title: e.target.value })} />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label>Description</label>
                <textarea rows={2} value={metric.description} onChange={(e) => updateMetric(i, { description: e.target.value })} />
              </div>
              {[1, 2, 3, 4, 5, 6, 7].map((lv) => (
                <div className="field" key={lv} style={{ marginTop: 8 }}>
                  <label>L{lv} expectation</label>
                  <input value={metric.levels?.[lv] || ''} onChange={(e) => updateLevel(i, lv, e.target.value)} />
                </div>
              ))}
              <button
                className="btn btn-plain"
                style={{ marginTop: 8 }}
                type="button"
                onClick={() => setEditing({ ...form, metrics: form.metrics.filter((_, idx) => idx !== i) })}
              >
                Remove metric
              </button>
            </div>
          ))}

          <button className="btn btn-ghost" type="button" onClick={() => setEditing({ ...form, metrics: [...form.metrics, EMPTY_METRIC()] })}>
            Add metric
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-accent" disabled={!canSave || busy} onClick={save}>Save role</button>
            <button className="btn btn-plain" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
