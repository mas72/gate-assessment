import { useEffect, useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import {
  api,
  SCALE,
  scoreLabel,
  scoreState,
  WEIGHT_LABELS,
  FIVE_METRICS,
  buildEvaluation,
  fmtDelta,
  fmtScore,
  verdictFor,
  VERDICTS,
  SCORE_MAX,
  SCORE_VALUES,
  normalizePeriod,
  periodSortKey,
} from './lib.js';
import { exportPdf, exportTeamPdf } from './pdf.js';
import MetricGuide from './MetricGuide.jsx';

const LEVEL_COLORS = ['#2563a8', '#2a9d8f', '#c77b2e', '#2d6a4f', '#6d28d9', '#b5342a', '#1e1c18'];
const SCALE_BY_VALUE = new Map(SCALE.map((s) => [s.value, s]));

function MetricCard({ metric, value, level, readOnly, onScore }) {
  const [open, setOpen] = useState(false);
  const scored = typeof value === 'number' && Number.isFinite(value);
  const expectation = metric.levels?.[level] || metric.levels?.[String(level)] || '';

  function keyScore(e) {
    if (readOnly) return;
    const n = Number(e.key);
    if (n >= 1 && n <= SCORE_MAX) {
      e.preventDefault();
      onScore(metric.id, n);
    }
  }

  return (
    <article className={`metric ${scored ? 'is-scored' : ''}`}>
      <div className="metric-top">
        <div>
          <h3>{metric.title}</h3>
          {metric.description && <p>{metric.description}</p>}
        </div>
        <div className={`metric-badge ${scored ? 'on' : ''}`}>
          <strong>{scored ? (Number.isInteger(value) ? value : value.toFixed(2)) : '—'}</strong>
          <span>{scored ? scoreLabel(value) : 'Not scored'}</span>
        </div>
      </div>

      {expectation && (
        <p className="metric-bar">
          <span>L{level} bar</span>
          {expectation}
        </p>
      )}

      <div className="metric-actions">
        <div className="scores" role="group" aria-label={`${metric.title} score`} onKeyDown={keyScore}>
          {SCORE_VALUES.map((n) => {
              const active = scored && (value === n || Math.round(value) === n);
              return (
                <button
                  key={n}
                  type="button"
                  className={`score-btn ${active ? 'on' : ''}`}
                  disabled={readOnly}
                  title={`${n} — ${SCALE_BY_VALUE.get(n).label}: ${SCALE_BY_VALUE.get(n).hint}`}
                  onClick={() => onScore(metric.id, active ? null : n)}
                >
                  {n}
                </button>
              );
            })}
        </div>
        <button type="button" className="details-btn" onClick={() => setOpen((s) => !s)}>
          {open ? 'Hide all levels' : 'Compare L1–L7'}
        </button>
      </div>

      {open && (
        <div className="levels-grid">
          {[1, 2, 3, 4, 5, 6, 7].map((lv) => (
            <div key={lv} className={lv === level ? 'current' : ''}>
              <strong>L{lv}</strong>
              {metric.levels?.[lv] || '—'}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ArchiveCard({ archive, compact }) {
  const rows = [
    ['Impact', '30%', archive.impact, 'Product output'],
    ['Execution', '25%', archive.execution, 'Quality of work'],
    ['Ownership', '20%', archive.ownership, 'Independence'],
    ['Collaboration', '15%', archive.collaboration, 'Teamwork'],
    ['Growth', '10%', archive.growth, 'Personal growth'],
  ];
  const bonus = archive.bonus ? `${Math.round(Number(archive.bonus) * 100)}%` : '—';
  return (
    <div className="card archive-card">
      <h2>Original spreadsheet review</h2>
      <p className="muted">
        Imported from the earlier evaluation file ({archive.jobLevel || 'level unspecified'}
        {archive.band ? ` · ${archive.band}` : ''}). These are the five original columns, not today’s L1–L7 metric grid.
      </p>
      {archive.incomplete && (
        <p className="notice" style={{ marginTop: 10 }}>No numeric scores were filled in for this person.</p>
      )}
      <div className="stat-row" style={{ marginTop: 14 }}>
        {rows.map(([label, weight, value, hint]) => (
          <div className="stat" key={label}>
            <strong>{value == null ? '—' : Number(value).toFixed(2)}</strong>
            <span>{label} · {weight}</span>
            {!compact && <small>{hint}</small>}
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>
        Spreadsheet final {archive.excelFinal == null ? '—' : Number(archive.excelFinal).toFixed(2)}
        {archive.computedFinal != null ? ` · recomputed ${Number(archive.computedFinal).toFixed(2)}` : ''}
        {' · '}bonus {bonus}
      </p>
    </div>
  );
}

function TeamReport({ saved, onOpen }) {
  const evaln = useMemo(() => buildEvaluation(saved), [saved]);
  if (!evaln.latest) return null;

  const hasPrior = Boolean(evaln.previous);
  const headline = hasPrior
    ? `${evaln.latest} vs ${evaln.previous}`
    : evaln.latest;

  return (
    <section className="card eval-card">
      <div className="card-head">
        <div>
          <h2>Evaluation report</h2>
          <p className="muted">
            Overall comparison of the five main metrics and the final score
            {hasPrior ? ` · ${headline}` : ` · ${evaln.latest}`}
          </p>
        </div>
        <button type="button" className="btn btn-pdf" onClick={() => exportTeamPdf(evaln)}>
          Export report PDF
        </button>
      </div>

      {!hasPrior && (
        <p className="notice" style={{ marginBottom: 14 }}>
          {evaln.latest} is the only quarter on record. Save a second quarter and every number below turns into a
          quarter-over-quarter comparison.
        </p>
      )}

      <div className="eval-final">
        {hasPrior && (
          <div>
            <span>{evaln.previous}</span>
            <strong>{fmtScore(evaln.teamPreviousFinal)}</strong>
          </div>
        )}
        <div className="is-latest">
          <span>{hasPrior ? evaln.latest : 'Team final'}</span>
          <strong>{fmtScore(evaln.teamLatestFinal)}</strong>
        </div>
        {hasPrior && (
          <div>
            <span>Change</span>
            <strong className={evaln.teamDelta < 0 ? 'neg' : 'pos'}>{fmtDelta(evaln.teamDelta)}</strong>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 10 }}>
        Team averages of the five main metrics, weighted into the final score out of {SCORE_MAX}.
      </p>

      <div className="stat-row eval-metrics">
        {FIVE_METRICS.map((m) => {
          const now = evaln.teamLatest[m.key];
          const before = evaln.teamPrevious[m.key];
          const delta = now != null && before != null ? now - before : null;
          return (
            <div className="stat" key={m.key}>
              <strong>{fmtScore(now)}</strong>
              <span>{m.label} · {Math.round(m.weight * 100)}%</span>
              <small>{hasPrior ? `${fmtScore(before)} → ${fmtDelta(delta)}` : m.hint}</small>
            </div>
          );
        })}
      </div>

      <table className="eval-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Level</th>
            {FIVE_METRICS.map((m) => <th key={m.key}>{m.label}</th>)}
            <th>Final</th>
            {hasPrior && <th>Δ</th>}
          </tr>
        </thead>
        <tbody>
          {evaln.people.map((p) => (
            <tr key={p.name}>
              <td>
                <button type="button" className="linkish" onClick={() => {
                  const match = saved.find((a) => a.name === p.name && normalizePeriod(a.period) === evaln.latest);
                  if (match) onOpen(match.id);
                }}>
                  {p.name}
                </button>
              </td>
              <td className="lvl">L{p.level}</td>
              {FIVE_METRICS.map((m) => {
                const now = p.latest?.[m.key];
                const before = p.previous?.[m.key];
                const delta = now != null && before != null ? now - before : null;
                return (
                  <td key={m.key}>
                    {fmtScore(now)}
                    {hasPrior && (
                      <em className={delta < 0 ? 'neg' : delta > 0 ? 'pos' : ''}>{fmtDelta(delta)}</em>
                    )}
                  </td>
                );
              })}
              <td><b>{fmtScore(p.latestFinal)}</b></td>
              {hasPrior && (
                <td className={p.delta < 0 ? 'neg' : p.delta > 0 ? 'pos' : ''}>{fmtDelta(p.delta)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SavedPanel({ saved, activeId, readOnly, onOpen, onNew, onDelete }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = saved.filter((a) => {
      if (!q) return true;
      return `${a.name} ${a.period} ${a.roleSlug}`.toLowerCase().includes(q);
    });
    const map = new Map();
    for (const a of filtered) {
      const key = normalizePeriod(a.period) || 'No period';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return [...map.entries()].sort((a, b) => {
      const [ay, aq] = periodSortKey(a[0]);
      const [by, bq] = periodSortKey(b[0]);
      return by - ay || bq - aq;
    });
  }, [saved, query]);

  const periodLabel = groups.length === 1 ? groups[0][0] : '';

  return (
    <section className={`saved ${open ? 'open' : ''}`}>
      <button type="button" className="saved-toggle" onClick={() => setOpen((s) => !s)}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        Archives
        <span className="count">{saved.length}</span>
        {periodLabel && <span className="muted">· {periodLabel}</span>}
        {!open && activeId != null && (
          <span className="muted">· viewing {saved.find((a) => a.id === activeId)?.name || 'review'}</span>
        )}
      </button>

      {open && (
        <div className="saved-body">
          <div className="saved-tools">
            <input
              className="search"
              value={query}
              placeholder="Search by name, period, or role…"
              onChange={(e) => setQuery(e.target.value)}
            />
            {!readOnly && (
              <button type="button" className="btn btn-ghost" onClick={onNew}>
                + New review
              </button>
            )}
          </div>
          {groups.length === 0 && <p className="muted">No reviews match “{query}”.</p>}
          {groups.map(([period, items]) => (
            <div className="saved-group" key={period}>
              {groups.length > 1 && <div className="row-label">{period}</div>}
              <div className="saved-list">
                {items.map((a) => {
                  const canDelete = !readOnly && a.archived;
                  return (
                    <div key={a.id} className={`chip-wrap ${activeId === a.id ? 'active' : ''}`}>
                      <button
                        type="button"
                        className={`chip ${activeId === a.id ? 'active' : ''}`}
                        onClick={() => onOpen(a.id)}
                      >
                        {a.name || 'Untitled'}
                        <em>L{a.level}</em>
                        {a.archived && <span className="tag">Archive</span>}
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="chip-delete"
                          title={`Delete ${a.name || 'archive'}`}
                          aria-label={`Delete ${a.name || 'archive'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(a);
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Assessment({ user, catalog, onOpenAdmin, onLogout }) {
  const readOnly = user.access !== 'admin';
  const [tab, setTab] = useState('overview');
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('');
  const [roleSlug, setRoleSlug] = useState(catalog.roles[0]?.slug || 'backend');
  const [level, setLevel] = useState(1);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [promotion, setPromotion] = useState({});
  const [assessmentId, setAssessmentId] = useState(null);
  const [archive, setArchive] = useState(null);
  const [saved, setSaved] = useState([]);
  const [toast, setToast] = useState(null);
  const [unscoredOnly, setUnscoredOnly] = useState(false);

  const role = catalog.roles.find((r) => r.slug === roleSlug) || catalog.roles[0];
  const stats = useMemo(() => scoreState(catalog, roleSlug, scores), [catalog, roleSlug, scores]);
  const expected = catalog.levelExpectations[level];
  const verdict = verdictFor(stats.overall, level, catalog.levelExpectations);
  const levelMeta = catalog.levels.find((l) => l.id === level);
  const promoDone = (levelMeta?.gates || []).filter((_, i) => promotion[i]).length;
  const pct = stats.total ? Math.round((stats.scored / stats.total) * 100) : 0;

  const radarData = ['technical', 'agile', 'soft', 'delivery', 'growth'].map((key) => ({
    domain: WEIGHT_LABELS[key],
    actual: stats.domainAvgs[key] || 0,
    expected,
  }));

  const payload = { name, period, roleSlug, level, scores, notes, promotion };
  const pdfPayload = { catalog, ...payload, archive, reviewer: user.displayName };

  useEffect(() => {
    api('/api/assessments')
      .then((d) => setSaved(d.assessments || []))
      .catch(() => {});
  }, []);

  function flash(message, kind = 'ok') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2200);
  }

  function setScore(id, value) {
    if (readOnly) return;
    setScores((prev) => {
      const next = { ...prev };
      if (value == null) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  function scoredCount(metrics) {
    return metrics.filter((m) => typeof scores[m.id] === 'number').length;
  }

  async function persist() {
    try {
      const data = assessmentId
        ? await api(`/api/assessments/${assessmentId}`, { method: 'PUT', body: payload })
        : await api('/api/assessments', { method: 'POST', body: payload });
      setAssessmentId(data.assessment.id);
      const list = await api('/api/assessments');
      setSaved(list.assessments || []);
      flash('Review saved');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  async function loadSaved(id) {
    try {
      const data = await api(`/api/assessments/${id}`);
      const a = data.assessment;
      setAssessmentId(a.id);
      setName(a.name || '');
      setPeriod(a.period || '');
      setRoleSlug(a.roleSlug || catalog.roles[0]?.slug);
      setLevel(a.level || 1);
      setScores(a.scores || {});
      setNotes(a.notes || '');
      setPromotion(a.promotion || {});
      setArchive(a.archive || null);
      setTab('overview');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  function fresh() {
    setAssessmentId(null);
    setName('');
    setPeriod('');
    setScores({});
    setNotes('');
    setPromotion({});
    setArchive(null);
    setTab('overview');
  }

  async function removeArchive(item) {
    if (readOnly || !item?.archived) return;
    const label = item.name || 'this archive';
    if (!confirm(`Delete archived assessment “${label}”? This cannot be undone.`)) return;
    try {
      await api(`/api/assessments/${item.id}`, { method: 'DELETE' });
      const list = await api('/api/assessments');
      setSaved(list.assessments || []);
      if (assessmentId === item.id) fresh();
      flash('Archive deleted');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  const scoringTabs = [
    { id: 'technical', label: `${role?.label || 'Technical'} skills`, metrics: role?.metrics || [] },
    ...catalog.sharedDomains.map((d) => ({ id: d.id, label: d.title, metrics: d.metrics })),
  ];
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...scoringTabs.map((t) => ({
      id: t.id,
      label: t.label,
      count: `${scoredCount(t.metrics)}/${t.metrics.length}`,
      done: scoredCount(t.metrics) === t.metrics.length && t.metrics.length > 0,
    })),
    { id: 'promo', label: 'Promotion', count: `${promoDone}/${levelMeta?.gates?.length || 0}` },
    { id: 'scorecard', label: 'Scorecard & notes' },
    { id: 'levels', label: 'Level guide' },
    { id: 'scoring', label: 'How scoring works' },
  ];

  const scoringIndex = scoringTabs.findIndex((t) => t.id === tab);
  const nextScoring = scoringIndex >= 0 ? scoringTabs[scoringIndex + 1] : null;
  const prevScoring = scoringIndex > 0 ? scoringTabs[scoringIndex - 1] : null;

  function renderMetrics(metrics) {
    const visible = unscoredOnly ? metrics.filter((m) => typeof scores[m.id] !== 'number') : metrics;
    if (!visible.length) {
      return <p className="muted" style={{ marginTop: 12 }}>Everything in this domain is scored.</p>;
    }
    return visible.map((metric) => (
      <MetricCard
        key={metric.id}
        metric={metric}
        value={scores[metric.id]}
        level={level}
        readOnly={readOnly}
        onScore={setScore}
      />
    ));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-logo">GATE <span>Assessment</span></div>
        <div className="topbar-spacer" />
        <div className="who">
          {user.displayName}
          <span className={`badge ${readOnly ? 'badge-ro' : 'badge-admin'}`}>{readOnly ? 'Read-only' : 'Admin'}</span>
        </div>
        {!readOnly && <button className="btn btn-quiet" onClick={onOpenAdmin}>Roles &amp; metrics</button>}
        <button className="btn btn-plain" onClick={onLogout}>Sign out</button>
      </header>

      {readOnly && (
        <div className="banner">
          Read-only access: browse rubrics, saved scorecards, and archives, and export any of them. Scoring and role
          edits are manager-only.
        </div>
      )}
      {archive && (
        <div className="banner banner-info">
          Archived review. The original five-column scores are preserved and also mapped onto today’s domains so the
          radar and exports still work.
        </div>
      )}

      <div className="workbench">
        <div className="identity">
          <div className="field">
            <label>Developer</label>
            <input value={name} disabled={readOnly} placeholder="Full name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Period</label>
            <input value={period} disabled={readOnly} placeholder="e.g. Q2 1405" onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="identity-actions">
            {!readOnly && <button className="btn btn-accent" onClick={persist}>Save</button>}
            <button className="btn btn-pdf" onClick={() => exportPdf(pdfPayload)}>Export PDF</button>
          </div>
        </div>

        <div className="scorestrip">
          <div className="scorestrip-main">
            <div className="progress-line">
              <div className="progress-bar"><i style={{ width: `${pct}%` }} /></div>
              <span>{stats.scored} of {stats.total} skills scored</span>
            </div>
            <div className="scorestrip-numbers">
              <div><strong>{stats.overall != null ? stats.overall.toFixed(2) : '—'}</strong><span>Overall</span></div>
              <div><strong>{expected.toFixed(1)}</strong><span>L{level} expected</span></div>
            </div>
          </div>
          {verdict && <div className={`verdict-pill ${verdict.key}`}>{verdict.label}</div>}
        </div>

        <div className="selectors">
          <div className="selector">
            <div className="row-label">Role track</div>
            <div className="pills">
              {catalog.roles.map((r) => (
                <button
                  key={r.slug}
                  className={`pill ${r.slug === role?.slug ? 'active' : ''}`}
                  onClick={() => setRoleSlug(r.slug)}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="selector">
            <div className="row-label">Career level</div>
            <div className="levels">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  className={`level ${level === n ? 'active' : ''}`}
                  title={catalog.levels.find((l) => l.id === n)?.summary}
                  onClick={() => setLevel(n)}
                >
                  L{n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SavedPanel
          saved={saved}
          activeId={assessmentId}
          readOnly={readOnly}
          onOpen={loadSaved}
          onNew={fresh}
          onDelete={removeArchive}
        />
      </div>

      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.count && <span className={`count ${t.done ? 'done' : ''}`}>{t.count}</span>}
          </button>
        ))}
      </nav>

      <div className="main">
        {tab === 'overview' && (
          <>
            <TeamReport saved={saved} onOpen={loadSaved} />
            <MetricGuide level={level} roleSlug={roleSlug} roleLabel={role?.label || 'Role'} />
            {archive && <ArchiveCard archive={archive} />}
            <div className="card">
              {stats.scored === 0 ? (
                <div className="empty">
                  <strong>No scores yet</strong>
                  <p>
                    {readOnly
                      ? 'Open a saved review above to see its scorecard, radar, and notes.'
                      : 'Pick the role track and level, then work through the scoring tabs.'}
                  </p>
                  {!readOnly && (
                    <button className="btn btn-accent" onClick={() => setTab(scoringTabs[0].id)}>
                      Start with {scoringTabs[0].label}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <h2>{name || 'Unnamed developer'} · {role?.label} L{level}</h2>
                  <p className="muted">
                    Weighted overall {stats.overall?.toFixed(2)} / {SCORE_MAX}, against {expected.toFixed(1)} expected
                    for L{level}.
                  </p>
                  {verdict && (
                    <div className={`verdict ${verdict.key}`}>
                      <div className="band">{verdict.band}</div>
                      <strong>{verdict.label}</strong>
                      <p>{verdict.action}</p>
                    </div>
                  )}
                  <div className="stat-row">
                    {stats.domains.map((d) => (
                      <div className="stat" key={d.weightKey}>
                        <strong>{stats.domainAvgs[d.weightKey] != null ? stats.domainAvgs[d.weightKey].toFixed(2) : '—'}</strong>
                        <span>{WEIGHT_LABELS[d.weightKey]}</span>
                        <small>{Math.round((catalog.weights[d.weightKey] || 0) * 100)}% weight</small>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h2>Performance radar</h2>
              <p className="muted">Domain averages against the L{level} expectation line.</p>
              <div className="radar-wrap">
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="domain" />
                    <PolarRadiusAxis domain={[0, SCORE_MAX]} tickCount={SCORE_MAX + 1} />
                    <Radar name="Actual" dataKey="actual" stroke="#2d6a4f" fill="#2d6a4f" fillOpacity={0.35} />
                    <Radar name="Expected" dataKey="expected" stroke="#9aa" fill="none" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="legend">
                <span><i className="dot dot-actual" /> Actual score</span>
                <span><i className="dot dot-exp" /> L{level} expected ({expected.toFixed(1)})</span>
              </div>
            </div>
          </>
        )}

        {scoringIndex >= 0 && (
          <div className="card">
            <div className="card-head">
              <div>
                <h2>{tab === 'technical' ? `${role?.icon || ''} ${role?.label} technical skills` : scoringTabs[scoringIndex].label}</h2>
                <p className="muted">
                  {Math.round((catalog.weights[tab === 'technical' ? 'technical' : catalog.sharedDomains.find((d) => d.id === tab)?.weightKey] || 0) * 100)}% of the final score ·
                  {' '}{scoredCount(scoringTabs[scoringIndex].metrics)} of {scoringTabs[scoringIndex].metrics.length} scored
                </p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={unscoredOnly} onChange={(e) => setUnscoredOnly(e.target.checked)} />
                Unscored only
              </label>
            </div>
            {renderMetrics(scoringTabs[scoringIndex].metrics)}
            <div className="step-nav">
              {prevScoring ? (
                <button className="btn btn-quiet" onClick={() => setTab(prevScoring.id)}>← {prevScoring.label}</button>
              ) : <span />}
              {nextScoring ? (
                <button className="btn btn-accent" onClick={() => setTab(nextScoring.id)}>{nextScoring.label} →</button>
              ) : (
                <button className="btn btn-accent" onClick={() => setTab('scorecard')}>Scorecard &amp; notes →</button>
              )}
            </div>
          </div>
        )}

        {tab === 'levels' && (
          <div className="card">
            <h2>Career level guide</h2>
            <p className="muted">Level is about impact and independence, not how busy someone looks.</p>
            {catalog.levels.map((lv) => (
              <div className={`level-card ${lv.id === level ? 'current' : ''}`} key={lv.id}>
                <div className="level-mark" style={{ background: LEVEL_COLORS[lv.id - 1] }}>L{lv.id}</div>
                <div>
                  <p>{lv.summary}</p>
                  <div className="gates">
                    <div className="row-label">Promotion gate criteria</div>
                    <ul>{lv.gates.map((g) => <li key={g}>{g}</li>)}</ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'scoring' && (
          <div className="card">
            <h2>How scoring works</h2>
            <p>
              Every skill is scored 1–{SCORE_MAX}, matching the L1–L{SCORE_MAX} ladder: a score of N describes the work
              expected of an L{'N'} engineer. Domain averages are combined with their weights into one overall score,
              and the headline Final Score stays the raw x.x / {SCORE_MAX} value.
            </p>
            <p style={{ marginTop: 10 }}>
              Because the scale and the ladder share the same range, someone at L{level} is expected around{' '}
              {expected.toFixed(1)} with room above them. The metric specifications on the overview page give the
              recommended score range per level for every parameter.
            </p>
            <h3 style={{ marginTop: 18 }}>Expected score per level</h3>
            <div className="stat-row">
              {Object.entries(catalog.levelExpectations).map(([lv, val]) => (
                <div className="stat" key={lv}>
                  <strong>{Number(val).toFixed(1)}</strong>
                  <span>L{lv}</span>
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>The 1–{SCORE_MAX} scale</h3>
            <div className="scale-list">
              {SCALE.map((s) => (
                <div key={s.value}>
                  <strong>{s.value} · {s.label}</strong>
                  <span>{s.hint}</span>
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>Review outcome</h3>
            <p className="muted">
              The outcome compares the weighted overall score with the score expected at the reviewed level.
            </p>
            {VERDICTS.map((v) => (
              <div className={`verdict ${v.key}`} key={v.key}>
                <div className="band">{v.band}</div>
                <strong>{v.label}</strong>
                <p>{v.action}</p>
              </div>
            ))}
            <p className="notice" style={{ marginTop: 16 }}>
              Do not use story points as an individual KPI. Score each domain with separate evidence, and give a named
              example for every 4+ or 2− score.
            </p>
          </div>
        )}

        {tab === 'promo' && (
          <div className="card">
            <h2>Promotion checklist — L{level} → L{Math.min(7, level + 1)}</h2>
            <p className="muted">{promoDone} of {levelMeta?.gates?.length || 0} criteria met</p>
            {(levelMeta?.gates || []).map((g, i) => (
              <label className="promo-item" key={g}>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={!!promotion[i]}
                  onChange={(e) => setPromotion((p) => ({ ...p, [i]: e.target.checked }))}
                />
                <span>{g}</span>
              </label>
            ))}
            <h3 style={{ marginTop: 20 }}>Universal promotion gate</h3>
            <ul className="gates">
              {catalog.universalPromotion.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {tab === 'scorecard' && (
          <div className="card">
            <h2>Scorecard &amp; notes</h2>
            {archive && <ArchiveCard archive={archive} compact />}
            {verdict && (
              <div className={`verdict ${verdict.key}`}>
                <div className="band">{verdict.band}</div>
                <strong>{verdict.label}</strong>
                <p>
                  Overall {stats.overall?.toFixed(2)} / {SCORE_MAX} against {expected.toFixed(1)} expected for L{level}.
                </p>
              </div>
            )}
            <div className="scorecard-table">
              {stats.domains.map((d) => (
                <div className="scorecard-domain" key={d.weightKey}>
                  <div className="scorecard-domain-head">
                    <strong>{d.title}</strong>
                    <span>
                      {Math.round((catalog.weights[d.weightKey] || 0) * 100)}% ·{' '}
                      {stats.domainAvgs[d.weightKey] != null ? stats.domainAvgs[d.weightKey].toFixed(2) : '—'}
                    </span>
                  </div>
                  {d.metrics.map((m) => (
                    <div className="scorecard-row" key={m.id}>
                      <span>{m.title}</span>
                      <b className={typeof scores[m.id] === 'number' ? '' : 'empty'}>
                        {typeof scores[m.id] === 'number'
                          ? (Number.isInteger(scores[m.id]) ? scores[m.id] : scores[m.id].toFixed(2))
                          : '—'}
                      </b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="field" style={{ marginTop: 18 }}>
              <label>Evidence notes</label>
              <textarea
                rows={8}
                disabled={readOnly}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Named examples, sprint refs, PRs, incidents, or peer quotes. Every 4+ or 2− should have an example."
              />
            </div>
            <div className="step-nav">
              <span />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-pdf" onClick={() => exportPdf(pdfPayload)}>Export PDF</button>
                {!readOnly && <button className="btn btn-accent" onClick={persist}>Save</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
