import { useState } from 'react';
import { SCORE_MAX, SCORE_VALUES } from './lib.js';
import { METRIC_SPECS, RAMP_LABELS, allBands, bandFor } from './metric-specs.js';

function pct(value) {
  return ((Math.min(SCORE_MAX, Math.max(1, value)) - 1) / (SCORE_MAX - 1)) * 100;
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

function SpecRow({ spec, level, roleSlug, roleLabel }) {
  const [open, setOpen] = useState(false);
  const band = bandFor(spec, level);
  const roleNote = spec.byRole?.[roleSlug];

  return (
    <div className="spec">
      <div className="spec-head">
        <div className="spec-title">
          <strong>{spec.title}</strong>
          <span className={`spec-ramp ${spec.ramp}`}>{RAMP_LABELS[spec.ramp]}</span>
        </div>
        <RangeBar band={band} level={level} />
      </div>
      <p className="spec-what">{spec.what}</p>
      {roleNote && (
        <p className="spec-role">
          <span>{roleLabel}</span>
          {roleNote}
        </p>
      )}
      <div className="spec-foot">
        <p className="spec-evidence">Evidence: {spec.evidence}</p>
        <button type="button" className="details-btn" onClick={() => setOpen((s) => !s)}>
          {open ? 'Hide L1–L7 ranges' : 'All L1–L7 ranges'}
        </button>
      </div>
      {open && (
        <div className="spec-levels">
          {allBands(spec).map((b) => (
            <div key={b.level} className={b.level === level ? 'current' : ''}>
              <strong>L{b.level}</strong>
              {b.min.toFixed(1)} – {b.max.toFixed(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MetricGuide({ level, roleSlug, roleLabel }) {
  const [active, setActive] = useState('impact');
  const [open, setOpen] = useState(false);
  const metric = METRIC_SPECS.find((m) => m.key === active) || METRIC_SPECS[0];

  return (
    <section className="card guide-card">
      <div className="card-head">
        <div>
          <h2>Metric specifications</h2>
          <p className="muted">
            What grows each of the five main metrics, and the score range recommended at L{level} on the{' '}
            {roleLabel} track. Scores run 1–{SCORE_MAX} against the L1–L{SCORE_MAX} ladder, so an L{level} sits around{' '}
            {level}. Ranges are guidance for calibration, not a cap.
          </p>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen((s) => !s)}>
          {open ? 'Hide' : 'Open guide'}
        </button>
      </div>

      {open && (
        <>
          <div className="guide-pills">
            {METRIC_SPECS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`pill ${m.key === active ? 'active' : ''}`}
                onClick={() => setActive(m.key)}
              >
                {m.label} <em>{Math.round(m.weight * 100)}%</em>
              </button>
            ))}
          </div>

          <div className="guide-intro">
            <strong>{metric.question}</strong>
            <span>{metric.basis}</span>
          </div>

          {metric.specs.map((spec) => (
            <SpecRow key={spec.id} spec={spec} level={level} roleSlug={roleSlug} roleLabel={roleLabel} />
          ))}

          <p className="notice" style={{ marginTop: 14 }}>
            Volume signals — commits, pull requests, lines of code, story points — are excluded on purpose. AI
            assistants inflate all of them, so they no longer separate levels. Score judgment, verification, and
            scope instead.
          </p>
        </>
      )}
    </section>
  );
}
