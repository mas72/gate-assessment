import { useEffect, useState } from 'react';
import { SCORE_MAX, SCORE_VALUES, scoreLabel } from './lib.js';
import { RAMP_LABELS, allBands, bandFor, rollupHint, rollupMetric } from './metric-specs.js';

function pct(value) {
  return ((Math.min(SCORE_MAX, Math.max(1, value)) - 1) / (SCORE_MAX - 1)) * 100;
}

function scoreBtnClass(value, n, current) {
  const scored = typeof value === 'number' && Number.isFinite(value);
  const active = scored && (value === n || Math.round(value) === n);
  const isCurrent = typeof current === 'number' && Number.isFinite(current) && Math.round(current) === n;
  return `score-btn${active ? ' on' : ''}${isCurrent ? ' is-current' : ''}`;
}

function RangeBar({ band, level }) {
  const left = pct(band.min);
  const width = Math.max(2, pct(band.max) - left);
  return (
    <div className="range">
      <div className="range-track">
        <span className="range-band" style={{ left: `${left}%`, width: `${width}%` }} />
        {SCORE_VALUES.map((n) => (
          <i key={n} className="range-tick" style={{ left: `${pct(n)}%` }} />
        ))}
      </div>
      <div className="range-caption">
        <span>L{level} target</span>
        <strong>
          {band.min.toFixed(1)} – {band.max.toFixed(1)}
        </strong>
      </div>
    </div>
  );
}

function BandEditor({ spec, onChange }) {
  const rows = allBands(spec);
  return (
    <div className="spec-band-edit">
      {rows.map((b) => (
        <label key={b.level}>
          <span>L{b.level}</span>
          <input
            type="number"
            min="1"
            max="7"
            step="0.1"
            value={b.min}
            onChange={(e) => {
              const next = allBands(spec).map((row) => [row.min, row.max]);
              next[b.level - 1] = [Number(e.target.value), b.max];
              onChange({ bands: next, ramp: spec.ramp });
            }}
          />
          <span>–</span>
          <input
            type="number"
            min="1"
            max="7"
            step="0.1"
            value={b.max}
            onChange={(e) => {
              const next = allBands(spec).map((row) => [row.min, row.max]);
              next[b.level - 1] = [b.min, Number(e.target.value)];
              onChange({ bands: next, ramp: spec.ramp });
            }}
          />
        </label>
      ))}
    </div>
  );
}

function SpecRow({
  spec,
  level,
  roleLabel,
  value,
  currentValue,
  readOnly,
  editing,
  onScore,
  onPatch,
  onRemove,
}) {
  const [open, setOpen] = useState(false);
  const band = bandFor(spec, level);
  const scored = typeof value === 'number' && Number.isFinite(value);

  return (
    <div className={`spec ${scored ? 'is-scored' : ''}`}>
      <div className="spec-head">
        <div className="spec-title">
          {editing ? (
            <input
              className="spec-input"
              value={spec.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="Parameter name"
            />
          ) : (
            <div className="spec-title-row">
              <strong>{spec.title}</strong>
              <span className={`spec-inline-score ${scored ? 'on' : ''}`}>
                {scored ? (Number.isInteger(value) ? value : value.toFixed(2)) : '—'}
              </span>
            </div>
          )}
          {editing ? (
            <div className="spec-edit-meta">
              <select
                value={spec.ramp || 'standard'}
                onChange={(e) => onPatch({ ramp: e.target.value, bands: undefined })}
              >
                {Object.entries(RAMP_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <label>
                Rollup weight
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={spec.weight ?? 1}
                  onChange={(e) => onPatch({ weight: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : (
            <span className={`spec-ramp ${spec.ramp}`}>
              {RAMP_LABELS[spec.ramp] || 'Core'}
              {spec.weight != null && Number(spec.weight) !== 1 ? ` · weight ${spec.weight}` : ''}
            </span>
          )}
        </div>
        <div className="spec-actions">
          <div className="scores" role="group" aria-label={`${spec.title} score`}>
            {SCORE_VALUES.map((n) => (
              <button
                key={n}
                type="button"
                className={scoreBtnClass(value, n, currentValue)}
                disabled={readOnly}
                title={`${n} — ${scoreLabel(n)}`}
                onClick={() => onScore(spec.id, scored && (value === n || Math.round(value) === n) ? null : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {editing ? (
        <textarea
          className="spec-input"
          rows={2}
          value={spec.what}
          placeholder="What this parameter measures"
          onChange={(e) => onPatch({ what: e.target.value })}
        />
      ) : (
        <p className="spec-what">{spec.what}</p>
      )}

      {editing ? (
        <input
          className="spec-input"
          value={spec.roleNote || ''}
          placeholder={`Role-specific note for ${roleLabel}`}
          onChange={(e) => onPatch({ roleNote: e.target.value })}
        />
      ) : (
        spec.roleNote && (
          <p className="spec-role">
            <span>{roleLabel}</span>
            {spec.roleNote}
          </p>
        )
      )}

      <div className="spec-foot">
        <div className="spec-foot-copy">
          {editing ? (
            <input
              className="spec-input"
              value={spec.evidence}
              placeholder="Evidence to look for"
              onChange={(e) => onPatch({ evidence: e.target.value })}
            />
          ) : (
            <p className="spec-evidence">Evidence: {spec.evidence}</p>
          )}
          {editing && (
            <button type="button" className="details-btn spec-remove" onClick={onRemove}>
              Remove parameter
            </button>
          )}
        </div>
        <div className="spec-foot-range">
          <RangeBar band={band} level={level} />
          <button type="button" className="details-btn" onClick={() => setOpen((s) => !s)}>
            {open ? 'Hide L1–L7 ranges' : editing ? 'Edit L1–L7 ranges' : 'All L1–L7 ranges'}
          </button>
        </div>
      </div>
      {open && (editing ? (
        <BandEditor spec={spec} onChange={onPatch} />
      ) : (
        <div className="spec-levels">
          {allBands(spec).map((b) => (
            <div key={b.level} className={b.level === level ? 'current' : ''}>
              <strong>L{b.level}</strong>
              {b.min.toFixed(1)} – {b.max.toFixed(1)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function MetricGuide({
  level,
  roleSlug,
  roleLabel,
  personName,
  specs,
  specScores,
  currentSpecScores,
  currentFive,
  readOnly,
  canEdit,
  archived,
  fromDefaults,
  onScore,
  onSaveSpecs,
  metricKey,
}) {
  const [active, setActive] = useState(metricKey || 'impact');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const catalog = editing && draft ? draft : specs?.metrics || [];
  const metric = catalog.find((m) => m.key === (metricKey || active)) || catalog[0];
  const rolled = metric ? rollupMetric(metric, specScores) : null;
  const currentRolled = metric ? (typeof currentFive?.[metric.key] === 'number' ? currentFive[metric.key] : null) : null;
  const singleMetric = Boolean(metricKey);

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setError('');
    const keys = (specs?.metrics || []).map((m) => m.key);
    if (metricKey && keys.includes(metricKey)) {
      setActive(metricKey);
    } else if (keys.length) {
      setActive((prev) => (keys.includes(prev) ? prev : keys[0]));
    }
  }, [personName, roleSlug, specs?.updatedAt, specs?.fromDefaults, metricKey]);

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(catalog)));
    setEditing(true);
    setError('');
  }

  function patchSpec(metricKey, specId, patch) {
    setDraft((prev) =>
      prev.map((m) => {
        if (m.key !== metricKey) return m;
        return {
          ...m,
          specs: m.specs.map((s) => {
            if (s.id !== specId) return s;
            const next = { ...s, ...patch };
            if (Object.prototype.hasOwnProperty.call(patch, 'bands') && patch.bands == null) {
              delete next.bands;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'bands') && patch.bands === undefined) {
              delete next.bands;
            }
            return next;
          }),
        };
      }),
    );
  }

  function addSpec(metricKey) {
    setDraft((prev) =>
      prev.map((m) => {
        if (m.key !== metricKey) return m;
        const id = `${metricKey}-p${Date.now().toString(36)}`;
        return {
          ...m,
          specs: [
            ...m.specs,
            {
              id,
              title: 'New parameter',
              ramp: 'standard',
              weight: 1,
              what: '',
              evidence: '',
              roleNote: '',
            },
          ],
        };
      }),
    );
  }

  function removeSpec(metricKey, specId) {
    setDraft((prev) =>
      prev.map((m) => (m.key === metricKey ? { ...m, specs: m.specs.filter((s) => s.id !== specId) } : m)),
    );
  }

  async function saveDraft() {
    if (!onSaveSpecs) return;
    setSaving(true);
    setError('');
    try {
      await onSaveSpecs(draft);
      setEditing(false);
      setDraft(null);
    } catch (err) {
      setError(err.message || 'Could not save specifications');
    } finally {
      setSaving(false);
    }
  }

  if (!catalog.length) {
    return (
      <section className="card guide-card">
        <div className="card-head">
          <div>
            <h2>Metric specifications</h2>
            <p className="muted">Select an employee to load their specification parameters.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card guide-card">
      <div className="card-head">
        <div>
          <h2>{singleMetric ? `${metric?.label || 'Metric'} specifications` : 'Metric specifications'}</h2>
          <p className="muted">
            {personName ? `${personName}'s ` : ''}
            {singleMetric
              ? `parameters that roll up into ${metric?.label || 'this metric'} on the 1–${SCORE_MAX} scale.`
              : `parameters that roll up into the five main metrics on the 1–${SCORE_MAX} scale.`}
            {' '}
            {archived
              ? 'Archive — original scores are locked.'
              : readOnly
                ? 'Viewing scores.'
                : 'Editing scores — tap 1–7 on each parameter.'}
          </p>
        </div>
        <div className="guide-head-actions">
          {canEdit && !editing && (
            <button type="button" className="btn btn-quiet" onClick={startEdit}>
              Edit specs
            </button>
          )}
          {editing && (
            <>
              <button type="button" className="btn btn-plain" onClick={() => { setEditing(false); setDraft(null); }}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent" disabled={saving} onClick={saveDraft}>
                {saving ? 'Saving…' : 'Save specs'}
              </button>
            </>
          )}
        </div>
      </div>

      {archived && (
        <p className="notice" style={{ marginBottom: 14 }}>
          Archive view. Specification parameters are shown for reference only — the original five metric numbers stay as captured.
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {!singleMetric && (
        <div className="guide-pills">
          {catalog.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`pill ${m.key === active ? 'active' : ''}`}
              onClick={() => setActive(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {metric && (
        <>
          <div className="guide-intro">
            <strong>{metric.question}</strong>
            <span>{metric.basis}</span>
            <div className="guide-rollup">
              <div className={`metric-badge ${rolled != null ? 'on' : ''}`}>
                <strong>{rolled != null ? (Number.isInteger(rolled) ? rolled : rolled.toFixed(2)) : '—'}</strong>
                <span>{metric.label}</span>
              </div>
              <p>
                {rollupHint(metric, specScores)}
                {metric.weight != null ? ` · ${Math.round(Number(metric.weight) * 100)}% of Final` : ''}
                {currentRolled != null ? ` · previous ${Number.isInteger(currentRolled) ? currentRolled : currentRolled.toFixed(2)}` : ''}
              </p>
            </div>
          </div>

          {metric.specs.map((spec) => (
            <SpecRow
              key={spec.id}
              spec={spec}
              level={level}
              roleLabel={roleLabel}
              value={specScores?.[spec.id]}
              currentValue={currentSpecScores?.[spec.id]}
              readOnly={readOnly || editing}
              editing={editing}
              onScore={onScore}
              onPatch={(patch) => patchSpec(metric.key, spec.id, patch)}
              onRemove={() => removeSpec(metric.key, spec.id)}
            />
          ))}

          {editing && (
            <button type="button" className="btn btn-ghost" onClick={() => addSpec(metric.key)}>
              + Add parameter to {metric.label}
            </button>
          )}
        </>
      )}

      <p className="notice" style={{ marginTop: 14 }}>
        Volume signals — commits, pull requests, lines of code, story points — are excluded on purpose. AI
        assistants inflate all of them, so they no longer separate levels. Score judgment, verification, and
        scope instead.
      </p>
    </section>
  );
}
