import { useEffect, useMemo, useRef, useState } from 'react';
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
  FIVE_METRICS,
  buildEvaluation,
  fmtDelta,
  fmtScore,
  SCORE_MAX,
  SCORE_VALUES,
  normalizePeriod,
  periodSortKey,
  levelFromScore,
  resolveFiveMetrics,
  finalFromFive,
  finalBreakdown,
  finalFormulaText,
  hasFive,
  peopleForRole,
  personKey,
  belongsToUser,
  CURRENT_PERIOD,
  downloadTeamReportPdf,
} from './lib.js';
import { exportPdf } from './pdf.js';
import MetricGuide from './MetricGuide.jsx';
import { cloneDefaultSpecs, fiveFromSpecScores } from './metric-specs.js';

const LEVEL_COLORS = ['#2563a8', '#2a9d8f', '#c77b2e', '#2d6a4f', '#6d28d9', '#b5342a', '#1e1c18'];
const SCALE_BY_VALUE = new Map(SCALE.map((s) => [s.value, s]));

function isPersistedAssessment(item) {
  if (item == null || item.id == null || item.id === '' || item.id === 'preview') return false;
  const id = Number(item.id);
  return Number.isInteger(id) && id > 0;
}

function sortByPeriodAsc(items) {
  return [...items].sort((a, b) => {
    const [ay, aq] = periodSortKey(a.period);
    const [by, bq] = periodSortKey(b.period);
    return ay - by || aq - bq;
  });
}

function scoreBtnClass(value, n, current) {
  const scored = typeof value === 'number' && Number.isFinite(value);
  const active = scored && (value === n || Math.round(value) === n);
  const isCurrent = typeof current === 'number' && Number.isFinite(current) && Math.round(current) === n;
  return `score-btn${active ? ' on' : ''}${isCurrent ? ' is-current' : ''}`;
}

function MetricCard({ metric, value, currentValue, level, readOnly, onScore }) {
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
          {SCORE_VALUES.map((n) => (
            <button
              key={n}
              type="button"
              className={scoreBtnClass(value, n, currentValue)}
              disabled={readOnly}
              title={`${n} — ${SCALE_BY_VALUE.get(n).label}: ${SCALE_BY_VALUE.get(n).hint}`}
              onClick={() => onScore(metric.id, scored && (value === n || Math.round(value) === n) ? null : n)}
            >
              {n}
            </button>
          ))}
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

function ArchiveCard({ archive }) {
  const bonus = archive.bonus ? `${Math.round(Number(archive.bonus) * 100)}%` : '—';
  return (
    <div className="card archive-card">
      <h2>Original spreadsheet review</h2>
      <p className="muted">
        Imported from the earlier evaluation file ({archive.jobLevel || 'level unspecified'}
        {archive.band ? ` · ${archive.band}` : ''}). Metric scores for this review are in the score table above.
      </p>
      <p className="muted" style={{ marginTop: 12 }}>
        Spreadsheet final {archive.excelFinal == null ? '—' : Number(archive.excelFinal).toFixed(2)}
        {archive.computedFinal != null ? ` · recomputed ${Number(archive.computedFinal).toFixed(2)}` : ''}
        {' · '}bonus {bonus}
      </p>
    </div>
  );
}

function TeamReport({ saved, onDownload, busy }) {
  const evaln = useMemo(() => buildEvaluation(saved), [saved]);
  const hasPrior = Boolean(evaln.previous);
  const n = evaln.people.length;
  const scored = evaln.scoredCount ?? n;

  return (
    <section className="card eval-card">
      <div className="card-head">
        <div>
          <h2>Team report</h2>
          <p className="muted">
            {n} employees
            {scored !== n ? ` · ${scored} scored` : ''}
            {evaln.latest
              ? hasPrior
                ? ` · ${evaln.latest} vs ${evaln.previous} · ${finalFormulaText()}`
                : ` · ${evaln.latest} · ${finalFormulaText()}`
              : ` · ${finalFormulaText()}`}
          </p>
        </div>
        <button type="button" className="btn btn-pdf" disabled={busy} onClick={onDownload}>
          {busy ? 'Preparing PDF…' : 'Team report PDF'}
        </button>
      </div>

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
    </section>
  );
}

function ScoreTable({ saved, onOpen }) {
  const evaln = useMemo(() => buildEvaluation(saved), [saved]);
  const hasPrior = Boolean(evaln.previous);

  return (
    <section className="card score-table-card">
      <div className="card-head">
        <div>
          <h2>Score table</h2>
          <p className="muted">
            Five main metrics and the weighted final score
            {evaln.latest ? ` · ${evaln.latest}` : ''}
            {hasPrior ? ` compared with ${evaln.previous}` : ''}
          </p>
        </div>
      </div>

      {evaln.people.length === 0 ? (
        <p className="muted">No scored employees in this role yet.</p>
      ) : (
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
            {evaln.people.map((p) => {
              const matchLevel = levelFromScore(p.latestFinal);
              const shownLevel = matchLevel || p.level;
              return (
                <tr key={p.name}>
                  <td>
                    <button type="button" className="linkish" onClick={() => {
                      const match = saved.find((a) => a.name === p.name && normalizePeriod(a.period) === evaln.latest);
                      if (match) onOpen(match.id);
                    }}>
                      {p.name}
                    </button>
                  </td>
                  <td className="lvl" title={matchLevel && matchLevel !== p.level ? `Matches score ${fmtScore(p.latestFinal)} (recorded L${p.level})` : undefined}>
                    L{shownLevel}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function withLivePreview(saved, live) {
  if (!live?.metrics || !live.name) return saved;
  const period = live.period || 'In progress';
  const synthetic = {
    id: live.id || 'preview',
    name: live.name,
    username: live.username,
    period,
    roleSlug: live.roleSlug,
    level: live.level,
    metrics: live.metrics,
    finalScore: live.finalScore,
    archived: false,
  };
  const rest = saved.filter((a) => {
    if (personKey(a) !== live.key) return true;
    if (a.archived) return true;
    return normalizePeriod(a.period) !== normalizePeriod(period);
  });
  return [...rest, synthetic];
}

function roleLabelFor(roles, slug) {
  return roles.find((r) => r.slug === slug)?.label || slug || '';
}

function ArchivesPanel({ saved, activeId, readOnly, roleFilter, roles, onRoleFilter, onOpen, onNew, onDelete }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byPerson = new Map();
    for (const a of saved) {
      const key = personKey(a) || `id:${a.id}`;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key).push(a);
    }

    const out = [];
    for (const [key, items] of byPerson) {
      const reviews = [...items].sort((a, b) => {
        const [ay, aq] = periodSortKey(a.period);
        const [by, bq] = periodSortKey(b.period);
        return by - ay || bq - aq;
      });
      const latest = reviews[0];
      const roleLabel = roleLabelFor(roles, latest.roleSlug);
      const personHay = `${latest.name || ''} ${latest.username || ''} ${roleLabel} ${latest.roleSlug || ''}`.toLowerCase();
      const personMatch = !q || personHay.includes(q);
      const visible = personMatch
        ? reviews
        : reviews.filter((a) => String(a.period || '').toLowerCase().includes(q));
      if (!visible.length) continue;
      out.push({
        key,
        name: latest.name || latest.username || 'Untitled',
        roleLabel,
        level: latest.level,
        reviews: visible,
      });
    }

    return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [saved, query, roles]);

  const personLabel = groups.length === 1 ? groups[0].name : '';

  return (
    <aside className="pane-left" aria-label="Archives">
      <section className={`saved ${open ? 'open' : ''}`}>
        <button type="button" className="saved-toggle" onClick={() => setOpen((s) => !s)}>
          <span className="caret">{open ? '▾' : '▸'}</span>
          Archives
          <span className="count">{saved.length}</span>
          {personLabel && <span className="muted">· {personLabel}</span>}
          {!open && activeId != null && (
            <span className="muted">· viewing {saved.find((a) => String(a.id) === String(activeId))?.name || 'review'}</span>
          )}
        </button>

        {open && (
          <div className="saved-body">
            {!readOnly && roles.length > 1 && (
              <label className="pane-filter">
                <span>Role</span>
                <select
                  value={roleFilter}
                  aria-label="Filter by role"
                  onChange={(e) => onRoleFilter(e.target.value)}
                >
                  <option value="">All roles</option>
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>{r.label}</option>
                  ))}
                </select>
              </label>
            )}
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
            {groups.length === 0 && (
              <p className="muted">{query ? `No reviews match “${query}”.` : 'No archived reviews yet.'}</p>
            )}
            {groups.map((group) => (
              <div className="saved-group pane-group" key={group.key}>
                <div className="pane-group-name">
                  <span className="pane-person">{group.name}</span>
                  <span className="pane-person-meta">
                    {[group.roleLabel, group.level != null && group.level !== '' ? `L${group.level}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <div className="saved-list">
                  {group.reviews.map((a) => {
                    const selected = String(a.id) === String(activeId);
                    const canDelete = !readOnly && isPersistedAssessment(a);
                    const period = normalizePeriod(a.period) || a.period || 'No period';
                    return (
                      <div key={a.id} className={`pane-row ${selected ? 'is-selected' : ''}`}>
                        <button
                          type="button"
                          className="pane-row-main"
                          onClick={() => onOpen(a.id)}
                        >
                          <span className="pane-period">{period}</span>
                          <span className="pane-meta">
                            {a.archived ? 'Archive' : 'Review'}
                          </span>
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="pane-del"
                            title={`Delete ${a.name || 'assessment'} ${period}`}
                            aria-label={`Delete ${a.name || 'assessment'} ${period}`}
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
    </aside>
  );
}

export default function Assessment({ user, catalog, onOpenAdmin, onLogout }) {
  const readOnly = user.access !== 'admin';
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(readOnly ? (user.displayName || '') : '');
  const [username, setUsername] = useState(readOnly ? user.username : null);
  const autoloaded = useRef(false);
  const [period, setPeriod] = useState('');
  const [roleSlug, setRoleSlug] = useState(catalog.roles[0]?.slug || 'backend');
  const [level, setLevel] = useState(1);
  const [storedLevel, setStoredLevel] = useState(null);
  const [levelTouched, setLevelTouched] = useState(false);
  const [scores, setScores] = useState({});
  const [fiveScores, setFiveScores] = useState({});
  const [specScores, setSpecScores] = useState({});
  const [currentScores, setCurrentScores] = useState({});
  const [currentFive, setCurrentFive] = useState({});
  const [currentSpecScores, setCurrentSpecScores] = useState({});
  const [employeeSpecs, setEmployeeSpecs] = useState(null);
  const [draftFrom, setDraftFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [promotion, setPromotion] = useState({});
  const [assessmentId, setAssessmentId] = useState(null);
  const [archive, setArchive] = useState(null);
  const [saved, setSaved] = useState([]);
  const [toast, setToast] = useState(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [listRole, setListRole] = useState('');

  const scoringLocked = readOnly || Boolean(archive) || !editing;
  const visibleSaved = useMemo(
    () => (readOnly ? saved.filter((a) => belongsToUser(a, user)) : saved),
    [saved, readOnly, user],
  );
  const role = catalog.roles.find((r) => r.slug === roleSlug) || catalog.roles[0];
  const roleSaved = useMemo(
    () => visibleSaved.filter((a) => a.roleSlug === roleSlug),
    [visibleSaved, roleSlug],
  );
  const rolePeople = useMemo(() => {
    const people = peopleForRole(visibleSaved, roleSlug);
    if (!readOnly) return people;
    const mine = people.filter((p) => belongsToUser(p, user));
    if (mine.length) return mine;
    return [{
      name: user.displayName,
      username: user.username,
      roleSlug,
      level: 1,
    }];
  }, [visibleSaved, roleSlug, readOnly, user]);
  const visibleRoles = useMemo(() => {
    if (!readOnly) return catalog.roles;
    const slugs = new Set(visibleSaved.map((a) => a.roleSlug).filter(Boolean));
    const mine = catalog.roles.filter((r) => slugs.has(r.slug));
    return mine.length ? mine : catalog.roles.filter((r) => r.slug === roleSlug);
  }, [catalog.roles, readOnly, visibleSaved, roleSlug]);
  const selectedPersonKey = personKey({ username, name });
  const resolvedSpecs = useMemo(() => {
    if (employeeSpecs && employeeSpecs.personKey === selectedPersonKey) return employeeSpecs;
    return {
      personKey: selectedPersonKey,
      roleSlug,
      metrics: cloneDefaultSpecs(roleSlug),
      fromDefaults: true,
    };
  }, [employeeSpecs, selectedPersonKey, roleSlug]);
  const specDriven = useMemo(
    () => fiveFromSpecScores(resolvedSpecs, specScores),
    [resolvedSpecs, specScores],
  );
  const five = useMemo(() => {
    if (archive) {
      return resolveFiveMetrics({ archive, archived: true });
    }
    if (specDriven) return specDriven;
    if (hasFive(fiveScores)) return resolveFiveMetrics({ metrics: fiveScores });
    return null;
  }, [archive, specDriven, fiveScores]);
  const specHints = useMemo(() => {
    const out = {};
    for (const metric of resolvedSpecs.metrics || []) {
      const specs = metric.specs || [];
      const scored = specs.filter((s) => typeof specScores[s.id] === 'number').length;
      const equal = specs.every((s) => (Number(s.weight) > 0 ? Number(s.weight) : 1) === (Number(specs[0]?.weight) > 0 ? Number(specs[0].weight) : 1));
      out[metric.key] = scored
        ? `${equal ? 'Average' : 'Weighted average'} of ${scored} of ${specs.length} spec parameters`
        : 'Rolls up from this person’s spec parameters';
    }
    return out;
  }, [resolvedSpecs, specScores]);
  const fiveBreak = finalBreakdown(five);
  const fiveFinal = fiveBreak.value;
  const matchingLevel = levelFromScore(fiveFinal);
  const effectiveLevel = levelTouched ? level : (matchingLevel || level);
  const expected = Number(
    catalog.levelExpectations[effectiveLevel]
      ?? catalog.levelExpectations[String(effectiveLevel)]
      ?? effectiveLevel,
  );
  const levelMeta = catalog.levels.find((l) => l.id === effectiveLevel);
  const promoDone = (levelMeta?.gates || []).filter((_, i) => promotion[i]).length;

  const radarData = FIVE_METRICS.map((m) => ({
    domain: m.label,
    actual: typeof five?.[m.key] === 'number' ? five[m.key] : 0,
    expected,
  }));

  const persistLevel = archive && !levelTouched ? (storedLevel || level) : effectiveLevel;
  const persistPeriod = period.trim() ? normalizePeriod(period) : CURRENT_PERIOD;
  const payload = {
    name,
    period: persistPeriod,
    roleSlug,
    level: persistLevel,
    scores,
    metrics: archive ? undefined : (specDriven || (hasFive(fiveScores) ? fiveScores : five)),
    specScores: archive ? undefined : specScores,
    finalScore: archive ? undefined : fiveFinal,
    notes,
    promotion,
    username,
  };
  const pdfPayload = {
    catalog,
    ...payload,
    level: effectiveLevel,
    archive,
    reviewer: user.displayName,
    specScores,
    employeeSpecs: resolvedSpecs,
    metrics: five,
  };
  const tableRecords = useMemo(
    () => withLivePreview(roleSaved, !archive && specDriven && name
      ? {
          id: assessmentId,
          key: selectedPersonKey,
          name,
          username,
          period: persistPeriod,
          roleSlug,
          level: persistLevel,
          metrics: specDriven,
          finalScore: finalFromFive(specDriven),
        }
      : null),
    [roleSaved, archive, specDriven, name, assessmentId, selectedPersonKey, username, persistPeriod, roleSlug, persistLevel],
  );

  useEffect(() => {
    api('/api/assessments')
      .then((d) => setSaved(d.assessments || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (autoloaded.current) return;
    if (!visibleSaved.length) {
      if (readOnly) {
        setName(user.displayName || '');
        setUsername(user.username);
      }
      return;
    }
    autoloaded.current = true;
    const sorted = sortByPeriodAsc(visibleSaved);
    const latest = sorted[sorted.length - 1];
    if (latest?.roleSlug) setRoleSlug(latest.roleSlug);
    if (latest?.id) loadSaved(latest.id);
  }, [readOnly, visibleSaved, user]);

  useEffect(() => {
    if (!selectedPersonKey) {
      setEmployeeSpecs(null);
      return undefined;
    }
    let cancelled = false;
    api(`/api/specs?person=${encodeURIComponent(selectedPersonKey)}&role=${encodeURIComponent(roleSlug)}`)
      .then((d) => {
        if (!cancelled) setEmployeeSpecs(d.specs);
      })
      .catch(() => {
        if (!cancelled) setEmployeeSpecs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPersonKey, roleSlug]);

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

  function setSpecScore(id, value) {
    if (readOnly || archive) return;
    setSpecScores((prev) => {
      const next = { ...prev };
      if (value == null) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  async function persist() {
    if (readOnly || archive || !editing) return;
    try {
      let id = assessmentId;
      if (!id && selectedPersonKey) {
        const existing = saved.find((a) => (
          !a.archived
          && isPersistedAssessment(a)
          && personKey(a) === selectedPersonKey
          && normalizePeriod(a.period) === persistPeriod
        ));
        if (existing) id = existing.id;
      }
      const data = id
        ? await api(`/api/assessments/${id}`, { method: 'PUT', body: payload })
        : await api('/api/assessments', { method: 'POST', body: payload });
      const savedId = data.assessment.id;
      const list = await api('/api/assessments');
      setSaved(list.assessments || []);
      setEditing(false);
      await loadSaved(savedId);
      setTab('overview');
      flash('Review saved');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  async function loadSaved(id, opts = {}) {
    try {
      const data = await api(`/api/assessments/${id}`);
      const a = data.assessment;
      const nextFive = resolveFiveMetrics({
        metrics: a.metrics,
        archive: a.archive,
        catalog,
        roleSlug: a.roleSlug,
        scores: a.scores,
        specScores: a.specScores,
        employeeSpecs: resolvedSpecs,
        archived: Boolean(a.archived),
      });
      setEditing(false);
      setAssessmentId(a.id);
      setName(a.name || '');
      setUsername(a.username || null);
      setPeriod(a.period || '');
      setRoleSlug(a.roleSlug || catalog.roles[0]?.slug);
      setStoredLevel(a.level || 1);
      setLevelTouched(false);
      setLevel(a.level || 1);
      setScores(a.scores || {});
      setFiveScores(nextFive || {});
      setSpecScores(a.specScores || {});
      setCurrentScores(a.scores || {});
      setCurrentFive(nextFive || {});
      setCurrentSpecScores(a.specScores || {});
      setDraftFrom('');
      setNotes(a.notes || '');
      setPromotion(a.promotion || {});
      setArchive(a.archive || null);
      if (!opts.keepTab) setTab('overview');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  async function downloadTeamPdf() {
    setTeamBusy(true);
    try {
      await downloadTeamReportPdf();
    } catch (err) {
      flash(err.message || 'Could not download team report', 'error');
    } finally {
      setTeamBusy(false);
    }
  }

  function cancelEdit() {
    if (isPersistedAssessment({ id: assessmentId })) {
      loadSaved(assessmentId, { keepTab: true });
      return;
    }
    resetDraft();
  }

  function resetDraft() {
    setEditing(false);
    setAssessmentId(null);
    setName(readOnly ? (user.displayName || '') : '');
    setUsername(readOnly ? user.username : null);
    setPeriod('');
    setScores({});
    setFiveScores({});
    setSpecScores({});
    setCurrentScores({});
    setCurrentFive({});
    setCurrentSpecScores({});
    setDraftFrom('');
    setNotes('');
    setPromotion({});
    setArchive(null);
    setStoredLevel(null);
    setLevelTouched(false);
    setLevel(1);
    setTab('overview');
  }

  function beginBlankEdit() {
    setEditing(true);
    setAssessmentId(null);
    setPeriod(CURRENT_PERIOD);
    setScores({});
    setFiveScores({});
    setSpecScores({});
    setCurrentScores({});
    setCurrentFive({});
    setCurrentSpecScores({});
    setDraftFrom('');
    setNotes('');
    setPromotion({});
    setArchive(null);
    setStoredLevel(null);
    setLevelTouched(false);
    setLevel(1);
    setTab('overview');
  }

  async function startNewFor(summary) {
    if (!summary) {
      beginBlankEdit();
      setName('');
      setUsername(null);
      return;
    }
    const person = personKey(summary);
    const existing = saved.find((a) => (
      !a.archived
      && isPersistedAssessment(a)
      && personKey(a) === person
      && normalizePeriod(a.period) === CURRENT_PERIOD
    ));
    const prior = [...saved]
      .filter((a) => personKey(a) === person && a.id !== existing?.id)
      .sort((a, b) => {
        const ka = periodSortKey(a.period);
        const kb = periodSortKey(b.period);
        return ka[0] - kb[0] || ka[1] - kb[1];
      })
      .at(-1);
    try {
      const data = await api(`/api/assessments/${existing?.id || summary.id}`);
      const a = data.assessment;
      const highlightFrom = prior || (existing ? null : a);
      const nextFive = resolveFiveMetrics({
        metrics: highlightFrom?.metrics || a.metrics,
        archive: highlightFrom?.archive || a.archive,
        catalog,
        roleSlug: a.roleSlug,
        scores: highlightFrom?.scores || a.scores,
        specScores: highlightFrom?.specScores || a.specScores,
        employeeSpecs: resolvedSpecs,
        archived: Boolean(highlightFrom?.archived ?? a.archived),
      });
      const workingFive = existing
        ? resolveFiveMetrics({
          metrics: a.metrics,
          archive: a.archive,
          catalog,
          roleSlug: a.roleSlug,
          scores: a.scores,
          specScores: a.specScores,
          employeeSpecs: resolvedSpecs,
          archived: Boolean(a.archived),
        })
        : null;
      const finalScore = existing
        ? (workingFive ? finalFromFive(workingFive) : a.finalScore)
        : (summary.finalScore ?? finalFromFive(nextFive));
      const inferred = levelFromScore(finalScore);
      setAssessmentId(existing ? existing.id : null);
      setEditing(true);
      setName(a.name || summary.name || '');
      setUsername(a.username || summary.username || null);
      setPeriod(CURRENT_PERIOD);
      setRoleSlug(a.roleSlug || roleSlug);
      setStoredLevel(existing ? a.level : null);
      setLevelTouched(false);
      setLevel(inferred || a.level || 1);
      setScores(existing ? (a.scores || {}) : {});
      setFiveScores(existing ? (workingFive || {}) : {});
      setSpecScores(existing ? (a.specScores || {}) : {});
      setCurrentScores(highlightFrom?.scores || a.scores || {});
      setCurrentFive(nextFive || {});
      setCurrentSpecScores(highlightFrom?.specScores || a.specScores || {});
      setDraftFrom(normalizePeriod(highlightFrom?.period || (!existing && a.period) || '') || '');
      setNotes(existing ? (a.notes || '') : '');
      setPromotion(existing ? (a.promotion || {}) : {});
      setArchive(null);
      setTab('overview');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  function pickEmployee(key) {
    if (!key) {
      beginBlankEdit();
      setName('');
      setUsername(null);
      return;
    }
    const person = rolePeople.find((p) => personKey(p) === key);
    if (person) startNewFor(person);
    else {
      beginBlankEdit();
      setName('');
      setUsername(null);
    }
  }

  function fresh() {
    const current = rolePeople.find((p) => personKey(p) === selectedPersonKey);
    if (current) startNewFor(current);
    else {
      beginBlankEdit();
      if (!readOnly) {
        setName('');
        setUsername(null);
      }
    }
  }

  async function removeAssessment(item) {
    if (readOnly || !isPersistedAssessment(item)) return;
    const label = item.name || 'this assessment';
    const kind = item.archived ? 'archived assessment' : 'saved assessment';
    const periodBit = item.period ? ` (${item.period})` : '';
    if (!confirm(`Delete ${kind} “${label}”${periodBit}? This cannot be undone.`)) return;
    try {
      await api(`/api/assessments/${item.id}`, { method: 'DELETE' });
      const list = await api('/api/assessments');
      setSaved(list.assessments || []);
      if (Number(assessmentId) === Number(item.id)) resetDraft();
      flash(item.archived ? 'Archive deleted' : 'Assessment deleted');
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  const metricTabs = FIVE_METRICS.map((m) => {
    const specs = (resolvedSpecs.metrics || []).find((row) => row.key === m.key)?.specs || [];
    const scored = specs.filter((s) => typeof specScores[s.id] === 'number').length;
    const parent = five?.[m.key];
    const archiveCount = typeof parent === 'number'
      ? (Number.isInteger(parent) ? String(parent) : parent.toFixed(2))
      : undefined;
    const short = { impact: 'Impact', execution: 'Exec', ownership: 'Owner', collaboration: 'Collab', growth: 'Growth' };
    return {
      id: m.key,
      label: short[m.key] || m.label,
      title: m.label,
      count: name && !archive
        ? (specs.length ? `${scored}/${specs.length}` : undefined)
        : (name && archive ? archiveCount : undefined),
      done: archive ? typeof parent === 'number' : (specs.length > 0 && scored === specs.length),
    };
  });
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...metricTabs,
    { id: 'guides', label: 'Guides' },
    { id: 'scorecard', label: 'Score', title: 'Scorecard & notes' },
  ];
  const canEditReview = !readOnly && isPersistedAssessment({ id: assessmentId }) && !archive;
  const modeKind = editing ? 'edit' : archive ? 'archive' : 'view';
  const modeText = editing ? 'Editing' : archive ? 'Archive' : 'Viewing';
  const navSaved = useMemo(
    () => (listRole ? visibleSaved.filter((a) => a.roleSlug === listRole) : visibleSaved),
    [visibleSaved, listRole],
  );
  const metricIndex = FIVE_METRICS.findIndex((m) => m.key === tab);
  const prevMetric = metricIndex > 0 ? FIVE_METRICS[metricIndex - 1] : null;
  const nextMetric = metricIndex >= 0 ? FIVE_METRICS[metricIndex + 1] : null;

  return (
    <div className={`app ${editing ? 'is-editing' : 'is-viewing'}`}>
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

      <div className="workspace">
        <ArchivesPanel
          saved={navSaved}
          activeId={assessmentId}
          readOnly={readOnly}
          roleFilter={listRole}
          roles={visibleRoles}
          onRoleFilter={setListRole}
          onOpen={(id) => loadSaved(id)}
          onNew={fresh}
          onDelete={removeAssessment}
        />

        <section className="pane-right">
          {archive && (
            <div className="banner banner-info">
              Archived review — original scores are locked.
            </div>
          )}
          {draftFrom && !archive && editing && (
            <div className="banner banner-info">
              New review for {name || 'this employee'}. Previous scores from {draftFrom} are highlighted.
            </div>
          )}

          {!editing && (
            <div className={`pane-right-head ${readOnly ? 'is-readonly' : ''}`}>
              <div className="pane-right-ident">
                <span className={`mode-chip ${modeKind}`}>{modeText}</span>
                <div>
                  <h1>{name || 'Select an assessment'}</h1>
                  <p className="pane-right-sub">
                    {period || 'No period'}
                    {role?.label ? ` · ${role.label}` : ''}
                    {effectiveLevel ? ` · L${effectiveLevel}` : ''}
                  </p>
                </div>
              </div>
              <div className="chrome-actions">
                {!readOnly && canEditReview && (
                  <button type="button" className="btn btn-accent" onClick={() => setEditing(true)}>Edit</button>
                )}
                {readOnly && name && (
                  <button type="button" className="btn btn-pdf" onClick={() => exportPdf(pdfPayload)}>Export PDF</button>
                )}
              </div>
            </div>
          )}

          {editing && (
            <div className="chrome-edit">
              <div className="chrome-bar is-editing">
                <span className={`mode-chip ${modeKind}`}>{modeText}</span>
                <div className="field chrome-field">
                  <label htmlFor="edit-employee">Employee</label>
                  <select
                    id="edit-employee"
                    value={rolePeople.some((p) => personKey(p) === selectedPersonKey) ? selectedPersonKey : ''}
                    disabled={readOnly}
                    onChange={(e) => pickEmployee(e.target.value)}
                  >
                    <option value="">{rolePeople.length ? 'Select employee…' : 'No employees in this role'}</option>
                    {rolePeople.map((p) => (
                      <option key={personKey(p)} value={personKey(p)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field chrome-field">
                  <label htmlFor="edit-name">Name</label>
                  <input id="edit-name" value={name} disabled={readOnly || !editing} placeholder="Full name" onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field chrome-field">
                  <label htmlFor="edit-period">Period</label>
                  <input id="edit-period" value={period} disabled={readOnly || !editing} placeholder="e.g. Q2 1405" onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <div className="field chrome-field">
                  <label htmlFor="edit-role">Role</label>
                  <select
                    id="edit-role"
                    value={roleSlug}
                    disabled={readOnly}
                    onChange={(e) => {
                      const slug = e.target.value;
                      const nextPeople = peopleForRole(visibleSaved, slug);
                      const stays = nextPeople.some((p) => personKey(p) === selectedPersonKey);
                      setRoleSlug(slug);
                      if (!stays) {
                        setName('');
                        setUsername(null);
                      }
                    }}
                  >
                    {visibleRoles.map((r) => (
                      <option key={r.slug} value={r.slug}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="chrome-actions">
                  <button type="button" className="btn btn-plain" onClick={cancelEdit}>Cancel</button>
                  <button type="button" className="btn btn-pdf" onClick={() => exportPdf(pdfPayload)}>Export PDF</button>
                  {!readOnly && isPersistedAssessment({ id: assessmentId }) && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        const item = saved.find((a) => String(a.id) === String(assessmentId));
                        if (item) removeAssessment(item);
                      }}
                    >
                      Delete
                    </button>
                  )}
                  {!readOnly && <button type="button" className="btn btn-accent" onClick={persist}>Save</button>}
                </div>
              </div>
              <div className="chrome-levels">
                <span className="context-kicker">Level</span>
                <div className="levels">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`level ${effectiveLevel === n ? 'active' : ''} ${matchingLevel === n ? 'match' : ''}`}
                      title={
                        matchingLevel === n
                          ? `Matches score ${fiveFinal != null ? fiveFinal.toFixed(1) : ''}`
                          : catalog.levels.find((l) => l.id === n)?.summary
                      }
                      onClick={() => {
                        if (scoringLocked) return;
                        setLevel(n);
                        setLevelTouched(true);
                      }}
                    >
                      L{n}
                    </button>
                  ))}
                </div>
              </div>
              {matchingLevel && (
                <p className="level-hint">
                  L{matchingLevel} matches the current score
                  {fiveFinal != null ? ` (${fiveFinal.toFixed(2)})` : ''}
                  {storedLevel && storedLevel !== matchingLevel ? ` · recorded L${storedLevel}` : ''}
                </p>
              )}
            </div>
          )}

          <nav className="tabs" aria-label="Assessment sections">
            <div className="tabs-inner">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab ${tab === t.id ? 'active' : ''}`}
                  aria-current={tab === t.id ? 'page' : undefined}
                  title={t.title || t.label}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.count && <span className={`count ${t.done ? 'done' : ''}`}>{t.count}</span>}
                </button>
              ))}
            </div>
          </nav>

      <div className="main">
        {tab === 'overview' && (
          <div className="overview-stack">
            <div className="kpi-row">
              <div className="card kpi-card kpi-score">
                <span className="kpi-label">Final score</span>
                <p className="overview-score-value">
                  {fiveFinal != null ? fiveFinal.toFixed(2) : '—'}
                </p>
                <p className="kpi-meta">{finalFormulaText()}</p>
                <p className="small">Unscored metrics count as 0 and keep their weight.</p>
              </div>
              <div className="card kpi-card kpi-level">
                <span className="kpi-label">Level</span>
                <div className="overview-level-row">
                  <span className="overview-level-mark" style={{ background: LEVEL_COLORS[effectiveLevel - 1] }}>
                    L{effectiveLevel}
                  </span>
                  <p>{levelMeta?.summary || 'Career level for this review.'}</p>
                </div>
              </div>
            </div>
            <div className="overview-mid">
              <div className="card overview-radar-card">
                <h2>Performance radar</h2>
                <p className="muted">
                  Impact, Execution, Ownership, Collaboration, and Growth.
                </p>
                <div className="radar-wrap">
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#d8d8cc" />
                      <PolarAngleAxis dataKey="domain" tick={{ fill: '#6b6b63', fontSize: 14 }} />
                      <PolarRadiusAxis domain={[0, SCORE_MAX]} tickCount={SCORE_MAX + 1} tick={{ fill: '#8a8a8a', fontSize: 12 }} />
                      <Radar name="Actual" dataKey="actual" stroke="#c97a32" fill="#c97a32" fillOpacity={0.22} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card overview-weights-card">
                <h2>Metric mix</h2>
                <p className="muted">Weighted contribution to Final. Scoring only Impact 7 is 2.10, not 7.</p>
                <div className="weight-list">
                  {fiveBreak.parts.map((m) => (
                    <div key={m.key} className={`weight-row ${m.included ? 'is-used' : 'is-skipped'}`}>
                      <div>
                        <strong>{m.label}</strong>
                        <span>{Math.round(m.weight * 100)}% of Final</span>
                      </div>
                      <em className={m.included ? 'chip-status on' : 'chip-status'}>
                        {m.included ? fmtScore(m.contribution) : '0'}
                      </em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {metricIndex >= 0 && (
          <div className="metric-pane">
            <MetricGuide
              metricKey={tab}
              level={effectiveLevel}
              roleSlug={roleSlug}
              roleLabel={role?.label || 'Role'}
              personName={name}
              specs={resolvedSpecs}
              specScores={specScores}
              currentSpecScores={currentSpecScores}
              currentFive={currentFive}
              readOnly={scoringLocked}
              canEdit={!scoringLocked && Boolean(selectedPersonKey)}
              archived={Boolean(archive)}
              fromDefaults={resolvedSpecs.fromDefaults}
              onScore={setSpecScore}
              onSaveSpecs={async (metrics) => {
                const data = await api('/api/specs', {
                  method: 'PUT',
                  body: { person: selectedPersonKey, roleSlug, metrics },
                });
                setEmployeeSpecs(data.specs);
              }}
            />
            <div className="step-nav">
              {prevMetric ? (
                <button className="btn btn-quiet" onClick={() => setTab(prevMetric.key)}>← {prevMetric.label}</button>
              ) : (
                <button className="btn btn-quiet" onClick={() => setTab('overview')}>← Overview</button>
              )}
              {nextMetric ? (
                <button className="btn btn-quiet" onClick={() => setTab(nextMetric.key)}>{nextMetric.label} →</button>
              ) : (
                <button className="btn btn-quiet" onClick={() => setTab('guides')}>Guides →</button>
              )}
            </div>
          </div>
        )}

        {tab === 'guides' && (
          <>
            <div className="card">
              <h2>Career level guide</h2>
              <p className="muted">Level is about impact and independence, not how busy someone looks.</p>
              {catalog.levels.map((lv) => (
                <div className={`level-card ${lv.id === effectiveLevel ? 'current' : ''}`} key={lv.id}>
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
            <div className="card">
              <h2>How scoring works</h2>
              <p>
                Every specification parameter is scored 1–{SCORE_MAX}, matching the L1–L{SCORE_MAX} ladder: a score of N
                describes the work expected of an L{'N'} engineer. Each of the five main metrics is the average of its
                scored parameters (or a weighted average when an admin sets different parameter weights). The headline
                Final Score is then:
              </p>
              <p className="formula-legend" style={{ marginTop: 10 }}>{finalFormulaText()}</p>
              <p style={{ marginTop: 10 }}>
                Unscored metrics count as 0 and keep their weight, so scoring only Impact does not make
                Final equal that Impact score. Result stays on the 1–{SCORE_MAX} scale — not a percentage.
              </p>
              <p style={{ marginTop: 10 }}>
                Because the scale and the ladder share the same range, someone at L{effectiveLevel} is expected around{' '}
                {expected.toFixed(1)} with room above them. Metric specifications are per employee: Alireza and Fatemeh
                can have different parameter wording, ranges, and weights. Changing a parameter score changes that
                person’s parent metric, radar, score table, and PDF.
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
              <p className="notice" style={{ marginTop: 16 }}>
                Do not use story points as an individual KPI. Score each specification with separate evidence, and give a
                named example for every 4+ or 2− score. Volume signals — commits, pull requests, lines of code, story
                points — are excluded on purpose.
              </p>
            </div>
            <div className="card">
              <h2>Promotion checklist — L{effectiveLevel} → L{Math.min(7, effectiveLevel + 1)}</h2>
              <p className="muted">{promoDone} of {levelMeta?.gates?.length || 0} criteria met</p>
              {(levelMeta?.gates || []).map((g, i) => (
                <label className="promo-item" key={g}>
                  <input
                    type="checkbox"
                    disabled={readOnly || !editing}
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
          </>
        )}

        {tab === 'scorecard' && (
          <>
            {!readOnly && (
              <TeamReport saved={visibleSaved} onDownload={downloadTeamPdf} busy={teamBusy} />
            )}
            <ScoreTable saved={tableRecords} onOpen={(id) => { if (id && id !== 'preview') loadSaved(id); }} />
            <div className="card notes-export-card">
              <div className="card-head">
                <div>
                  <h2>Notes</h2>
                  <p className="muted">
                    Evidence for this review. Parameter scores live on each metric tab and roll up in the table above.
                  </p>
                </div>
              </div>
              {archive && <ArchiveCard archive={archive} />}
              {five && (
                <div className="scorecard-table" style={{ marginBottom: 16 }}>
                  <div className="scorecard-domain">
                    <div className="scorecard-domain-head">
                      <strong>Five main metrics</strong>
                      <span>{finalFormulaText()}</span>
                    </div>
                    {FIVE_METRICS.map((m) => (
                      <div className="scorecard-row" key={m.key}>
                        <span>{m.label} · {Math.round(m.weight * 100)}%</span>
                        <b className={typeof five[m.key] === 'number' ? '' : 'empty'}>
                          {typeof five[m.key] === 'number'
                            ? (Number.isInteger(five[m.key]) ? five[m.key] : five[m.key].toFixed(2))
                            : '—'}
                        </b>
                      </div>
                    ))}
                    <div className="scorecard-row scorecard-final">
                      <span>Final</span>
                      <b>{fiveFinal != null ? fiveFinal.toFixed(2) : '—'}</b>
                    </div>
                  </div>
                  {(resolvedSpecs.metrics || []).map((metric) => (
                    <div className="scorecard-domain" key={metric.key}>
                      <div className="scorecard-domain-head">
                        <strong>{metric.label} parameters</strong>
                        <span>{specHints[metric.key]}</span>
                      </div>
                      {metric.specs.map((spec) => (
                        <div className="scorecard-row" key={spec.id}>
                          <span>{spec.title}</span>
                          <b className={typeof specScores[spec.id] === 'number' ? '' : 'empty'}>
                            {typeof specScores[spec.id] === 'number' ? specScores[spec.id] : '—'}
                          </b>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="field" style={{ marginTop: 18 }}>
                <label>Evidence notes</label>
                <textarea
                  rows={8}
                  disabled={readOnly || !editing}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Named examples, sprint refs, PRs, incidents, or peer quotes. Every 4+ or 2− should have an example."
                />
              </div>
            </div>
          </>
        )}
      </div>
        </section>
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}
