import { fiveFromSpecScores } from './metric-specs.js';

export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function downloadTeamReportPdf() {
  const res = await fetch('/api/reports/team.pdf', { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'GATE-team-progress.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const WEIGHT_LABELS = {
  technical: 'Technical skills',
  agile: 'Agile & Scrum',
  soft: 'Soft skills',
  delivery: 'Delivery & Quality',
  growth: 'Growth',
};

// Scores run 1-7 to line up with the L1-L7 ladder: a score of N describes the work
// expected of an LN engineer, so an L3 sits mid-scale with room above them.
export const SCORE_MAX = 7;
export const SCORE_VALUES = [1, 2, 3, 4, 5, 6, 7];

export const SCALE = [
  { value: 7, label: 'Exceptional', hint: 'Sets the bar for the whole organisation' },
  { value: 6, label: 'Expert', hint: 'Sets technical direction beyond the team' },
  { value: 5, label: 'Advanced', hint: 'Drives outcomes across several areas' },
  { value: 4, label: 'Strong', hint: 'Owns a system and lifts the people around them' },
  { value: 3, label: 'Proficient', hint: 'Solid, independent delivery' },
  { value: 2, label: 'Developing', hint: 'Delivers defined work with support' },
  { value: 1, label: 'Foundational', hint: 'Learning the basics with close guidance' },
];

export function scoreLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'Not scored';
  const rounded = Math.round(Number(value));
  return SCALE.find((s) => s.value === rounded)?.label || 'Not scored';
}

// Expected raw score per level. Mirrors LEVEL_EXPECTATIONS in server/seed-data.js,
// used only when the catalog has not been loaded yet.
export const LEVEL_EXPECTATIONS = { 1: 1.0, 2: 2.0, 3: 3.0, 4: 4.0, 5: 5.0, 6: 6.0, 7: 6.8 };

export function expectedForLevel(level, expectations) {
  const lv = Math.min(7, Math.max(1, Number(level) || 1));
  const table = expectations || LEVEL_EXPECTATIONS;
  const value = table[lv] ?? table[String(lv)];
  return typeof value === 'number' && value > 0 ? value : LEVEL_EXPECTATIONS[lv];
}

export const VERDICTS = [
  {
    key: 'exceptional',
    label: 'Exceptional',
    band: 'Far above level',
    minDiff: 1.1,
    action: 'Nominate for promotion review and discuss next-level expectations.',
  },
  {
    key: 'above',
    label: 'Above expectations',
    band: 'Above level',
    minDiff: 0.4,
    action: 'Acknowledge the work, add stretch scope, accelerate the growth plan.',
  },
  {
    key: 'meets',
    label: 'Meets expectations',
    band: 'At level',
    minDiff: -0.4,
    action: 'Standard merit path. Keep the current development plan.',
  },
  {
    key: 'below',
    label: 'Needs improvement',
    band: 'Below level',
    minDiff: -1.1,
    action: 'Written improvement plan, regular check-ins, targeted coaching.',
  },
  {
    key: 'unsat',
    label: 'Unsatisfactory',
    band: 'Well below level',
    minDiff: -Infinity,
    action: 'Immediate performance plan with weekly coaching.',
  },
];

// Verdict from the raw score against the score expected at the reviewed level.
export function verdictFor(raw, level, expectations) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const expected = expectedForLevel(level, expectations);
  const diff = Number(raw) - expected;
  return VERDICTS.find((v) => diff >= v.minDiff) || VERDICTS[VERDICTS.length - 1];
}

export function scoreState(catalog, roleSlug, scores) {
  const role = catalog.roles.find((r) => r.slug === roleSlug) || catalog.roles[0];
  const domains = [
    { id: 'technical', title: `${role?.label || ''} Technical Skills`.trim(), weightKey: 'technical', metrics: role?.metrics || [] },
    ...catalog.sharedDomains,
  ];
  const domainAvgs = {};
  let scored = 0;
  let total = 0;
  let weighted = 0;
  let weightUsed = 0;

  for (const domain of domains) {
    total += domain.metrics.length;
    const values = domain.metrics
      .map((m) => scores[m.id])
      .filter((v) => typeof v === 'number');
    scored += values.length;
    if (values.length) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      domainAvgs[domain.weightKey] = avg;
      const w = catalog.weights[domain.weightKey] || 0;
      weighted += avg * w;
      weightUsed += w;
    }
  }

  const overall = weightUsed ? weighted / weightUsed : null;
  return { role, domains, domainAvgs, scored, total, overall };
}

export const FIVE_METRICS = [
  { key: 'impact', label: 'Impact', weight: 0.3, hint: 'Product output' },
  { key: 'execution', label: 'Execution', weight: 0.25, hint: 'Quality of work' },
  { key: 'ownership', label: 'Ownership', weight: 0.2, hint: 'Independence' },
  { key: 'collaboration', label: 'Collaboration', weight: 0.15, hint: 'Teamwork' },
  { key: 'growth', label: 'Growth', weight: 0.1, hint: 'Personal growth' },
];

/** Legend for the headline formula. Weights stay as 0.30·Metric (30% in copy is fine). */
export function finalFormulaText() {
  return `Final = ${FIVE_METRICS.map((m) => `${m.weight.toFixed(2)}·${m.label}`).join(' + ')}`;
}

/**
 * Weighted final from the five parent metrics.
 * Unscored metrics count as 0 and keep their weight, so one Impact score
 * cannot become 100% of Final:
 * final = 0.30·Impact + 0.25·Execution + 0.20·Ownership + 0.15·Collaboration + 0.10·Growth
 */
export function finalBreakdown(metrics) {
  const parts = [];
  let sum = 0;
  let any = false;
  for (const m of FIVE_METRICS) {
    const v = metrics?.[m.key];
    const included = typeof v === 'number' && Number.isFinite(v);
    if (included) {
      sum += v * m.weight;
      any = true;
    }
    parts.push({
      ...m,
      value: included ? v : null,
      included,
      contribution: included ? v * m.weight : 0,
    });
  }
  return {
    value: any ? Math.round(sum * 1000) / 1000 : null,
    weightUsed: 1,
    parts,
  };
}

/** Extra names used on Q1 archive rows that differ from login display names. */
export const USER_ALIASES = {
  'ali.dehghan': ['Alireza Dehghan', 'Ali Dehghan'],
  'a.ghasemi': ['Ali Ghasemi', 'A. Ghasemi'],
  'f.ahmadi': ['Fatemeh Ahmadi', 'F. Ahmadi'],
  'a.pahlavanian': ['Abolfazl Pahlavanian', 'A. Pahlavanian'],
  'hamed.dehghan': ['Hamed Dehghan'],
  'hosseini.motlagh': ['Laya Hosseini Motlagh', 'Hosseini Motlagh'],
  'm.noeiaval': ['Mohsen Noeiaval', 'M. Noeiaval'],
  'm.dehghan': ['Masoud Dehghan'],
};

export const PERIOD_YEAR = '1405';
export const CURRENT_PERIOD = `Q2 ${PERIOD_YEAR}`;

export function identityKeys(user) {
  const username = String(user?.username || '').trim().toLowerCase();
  const aliases = USER_ALIASES[username] || [];
  return [user?.username, user?.displayName, ...aliases]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

export function belongsToUser(record, user) {
  if (!user) return false;
  if (user.access === 'admin' || user.isAdmin) return true;
  const keys = new Set(identityKeys(user));
  const username = String(record?.username || '').trim().toLowerCase();
  const name = String(record?.name || '').trim().toLowerCase();
  const person = String(record?.personKey || '').trim().toLowerCase();
  return (username && keys.has(username))
    || (name && keys.has(name))
    || (person && keys.has(person));
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizePeriod(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/\s+/g, ' ');
  const glued = s.match(/^Q(\d)(\d{4})$/i);
  if (glued) return `Q${glued[1]} ${glued[2]}`;
  const spaced = s.match(/^Q\s*(\d+)\s+(\d{4})$/i);
  if (spaced) return `Q${spaced[1]} ${spaced[2]}`;
  const bare = s.match(/^Q\s*(\d+)$/i);
  if (bare) return `Q${bare[1]} ${PERIOD_YEAR}`;
  return s;
}

export function periodSortKey(raw) {
  const s = normalizePeriod(raw);
  if (/^in progress$/i.test(s)) return [9999, 9, s];
  const dated = s.match(/^Q(\d+)\s+(\d+)$/i);
  if (dated) return [Number(dated[2]), Number(dated[1]), s];
  const bare = s.match(/^Q(\d+)$/i);
  if (bare) return [9998, Number(bare[1]), s];
  return [0, 0, s];
}

export function fiveFromRecord(record) {
  const src = record?.metrics || record?.archive;
  if (!src) return null;
  const out = {};
  let any = false;
  for (const m of FIVE_METRICS) {
    const v = src[m.key];
    out[m.key] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    if (out[m.key] != null) any = true;
  }
  return any ? out : null;
}

export function finalFromFive(metrics, fallback) {
  const value = finalBreakdown(metrics).value;
  if (value == null) return fallback ?? null;
  return value;
}

export function personKey(record) {
  return String(record?.username || record?.name || '').trim().toLowerCase();
}

/** Map a 1–7 score onto the matching career level (L1~1 … L7~7). */
export function levelFromScore(score) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  return Math.min(7, Math.max(1, Math.round(Number(score))));
}

export function hasFive(metrics) {
  return Boolean(metrics && FIVE_METRICS.some((m) => typeof metrics[m.key] === 'number'));
}

const OWNERSHIP_SKILL_IDS = new Set(['ownership', 'pressure']);

function avgOfMetrics(metrics, scores) {
  const values = (metrics || [])
    .map((m) => scores?.[m.id])
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Derive the five main metrics from the skill-domain scores. */
export function fiveFromSkillScores(catalog, roleSlug, scores) {
  if (!catalog || !scores) return null;
  const role = catalog.roles.find((r) => r.slug === roleSlug) || catalog.roles[0];
  const byKey = Object.fromEntries((catalog.sharedDomains || []).map((d) => [d.weightKey, d]));
  const agile = byKey.agile?.metrics || [];
  const delivery = byKey.delivery?.metrics || [];
  const soft = byKey.soft?.metrics || [];
  const growth = byKey.growth?.metrics || [];
  const own = soft.filter((m) => OWNERSHIP_SKILL_IDS.has(m.id));
  const collab = soft.filter((m) => !OWNERSHIP_SKILL_IDS.has(m.id));
  const out = {
    impact: avgOfMetrics(role?.metrics, scores),
    execution: avgOfMetrics([...agile, ...delivery], scores),
    ownership: avgOfMetrics(own, scores),
    collaboration: avgOfMetrics(collab, scores),
    growth: avgOfMetrics(growth, scores),
  };
  return hasFive(out) ? out : null;
}

export function resolveFiveMetrics({
  metrics,
  archive,
  catalog,
  roleSlug,
  scores,
  specScores,
  employeeSpecs,
  archived,
}) {
  if (archived && archive) {
    const fromArchive = fiveFromRecord({ archive });
    if (fromArchive) return fromArchive;
  }
  const fromSpecs = fiveFromSpecScores(employeeSpecs, specScores);
  if (fromSpecs) return fromSpecs;
  if (hasFive(metrics)) {
    const out = {};
    for (const m of FIVE_METRICS) {
      const v = metrics[m.key];
      out[m.key] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
    return out;
  }
  const fromArchive = fiveFromRecord({ archive });
  if (fromArchive) return fromArchive;
  return fiveFromSkillScores(catalog, roleSlug, scores);
}

function isNewerPeriod(a, b) {
  const [ay, aq] = periodSortKey(a);
  const [by, bq] = periodSortKey(b);
  if (ay !== by) return ay > by;
  if (aq !== bq) return aq > bq;
  return false;
}

export function latestByPerson(records) {
  const map = new Map();
  for (const r of records || []) {
    const key = personKey(r);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || isNewerPeriod(r.period, prev.period)) map.set(key, r);
  }
  return map;
}

export function peopleForRole(records, roleSlug) {
  const latest = latestByPerson((records || []).filter((r) => r.roleSlug === roleSlug));
  return [...latest.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function avgMetrics(rows) {
  const out = {};
  for (const m of FIVE_METRICS) {
    const vals = rows.map((r) => r.metrics?.[m.key]).filter((v) => typeof v === 'number');
    out[m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

export function buildEvaluation(records) {
  const rows = (records || []).map((r) => {
    const metrics = fiveFromRecord(r);
    const finalScore = finalFromFive(metrics) ?? (typeof r.finalScore === 'number' ? r.finalScore : null);
    return {
      ...r,
      period: normalizePeriod(r.period),
      metrics,
      finalScore,
      key: personKey(r),
    };
  }).filter((r) => r.key);

  const periods = [...new Set(rows.map((r) => r.period).filter(Boolean))].sort((a, b) => {
    const [ay, aq] = periodSortKey(a);
    const [by, bq] = periodSortKey(b);
    return ay - by || aq - bq;
  });

  const latest = periods[periods.length - 1] || '';
  const q1Period = periods.find((p) => /^Q1\s+1405$/i.test(p)) || '';
  const previous = latest && q1Period && latest !== q1Period
    ? q1Period
    : (periods.length > 1 ? periods[periods.length - 2] : '');

  const byKey = new Map();
  for (const r of rows) {
    const list = byKey.get(r.key) || [];
    list.push(r);
    byKey.set(r.key, list);
  }

  const people = [...byKey.values()].map((list) => {
    list.sort((a, b) => {
      const [ay, aq] = periodSortKey(a.period);
      const [by, bq] = periodSortKey(b.period);
      return ay - by || aq - bq;
    });
    const baseline = (q1Period && list.find((r) => r.period === q1Period)) || list[0];
    const now = list[list.length - 1];
    const hasLater = Boolean(now && baseline && now.period !== baseline.period);
    const latestMetrics = now?.metrics || null;
    const previousMetrics = hasLater ? (baseline?.metrics || null) : null;
    const latestFinal = now?.finalScore ?? finalFromFive(latestMetrics);
    const previousFinal = hasLater
      ? (baseline?.finalScore ?? finalFromFive(previousMetrics))
      : null;
    return {
      name: now?.name || baseline?.name,
      username: now?.username || baseline?.username || null,
      roleSlug: now?.roleSlug || baseline?.roleSlug,
      level: now?.level || baseline?.level,
      latestPeriod: now?.period || '',
      previousPeriod: hasLater ? baseline.period : '',
      onlyBaseline: !hasLater,
      incomplete: !latestMetrics && !previousMetrics,
      latest: latestMetrics,
      previous: previousMetrics,
      latestFinal,
      previousFinal,
      delta: latestFinal != null && previousFinal != null ? latestFinal - previousFinal : null,
      notes: now?.notes || '',
      evidence: now?.evidence || '',
    };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const latestRows = rows.filter((r) => r.period === latest && r.metrics);
  const prevRows = previous ? rows.filter((r) => r.period === previous && r.metrics) : [];
  const teamLatest = avgMetrics(latestRows);
  const teamPrevious = avgMetrics(prevRows);
  const teamLatestFinal = finalFromFive(teamLatest);
  const teamPreviousFinal = previous ? finalFromFive(teamPrevious) : null;

  return {
    latest,
    previous,
    q1Period,
    people,
    scoredCount: people.filter((p) => !p.incomplete).length,
    teamLatest,
    teamPrevious,
    teamLatestFinal,
    teamPreviousFinal,
    teamDelta:
      teamLatestFinal != null && teamPreviousFinal != null ? teamLatestFinal - teamPreviousFinal : null,
  };
}

export function fmtDelta(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

export function fmtScore(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
}
