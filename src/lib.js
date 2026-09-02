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
  return s;
}

export function periodSortKey(raw) {
  const s = normalizePeriod(raw);
  const m = s.match(/^Q(\d+)\s+(\d+)$/i);
  if (!m) return [0, 0, s];
  return [Number(m[2]), Number(m[1]), s];
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
  if (!metrics) return fallback ?? null;
  let sum = 0;
  let weight = 0;
  for (const m of FIVE_METRICS) {
    const v = metrics[m.key];
    if (typeof v === 'number') {
      sum += v * m.weight;
      weight += m.weight;
    }
  }
  if (!weight) return fallback ?? null;
  return Math.round((sum / weight) * 1000) / 1000;
}

function personKey(record) {
  return String(record.username || record.name || '').trim().toLowerCase();
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
    const finalScore = r.finalScore ?? finalFromFive(metrics, r.archive?.computedFinal ?? r.archive?.excelFinal);
    return {
      ...r,
      period: normalizePeriod(r.period),
      metrics,
      finalScore,
      key: personKey(r),
    };
  });

  const periods = [...new Set(rows.map((r) => r.period).filter(Boolean))].sort((a, b) => {
    const [ay, aq] = periodSortKey(a);
    const [by, bq] = periodSortKey(b);
    return ay - by || aq - bq;
  });

  const latest = periods[periods.length - 1] || '';
  const previous = periods.length > 1 ? periods[periods.length - 2] : '';
  const latestRows = rows.filter((r) => r.period === latest && r.metrics);
  const prevRows = previous ? rows.filter((r) => r.period === previous && r.metrics) : [];
  const prevByKey = new Map(prevRows.map((r) => [r.key, r]));

  const people = latestRows
    .map((now) => {
      const before = prevByKey.get(now.key);
      return {
        name: now.name,
        roleSlug: now.roleSlug,
        level: now.level,
        latest: now.metrics,
        previous: before?.metrics || null,
        latestFinal: now.finalScore,
        previousFinal: before?.finalScore ?? null,
        delta: now.finalScore != null && before?.finalScore != null ? now.finalScore - before.finalScore : null,
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const teamLatest = avgMetrics(latestRows);
  const teamPrevious = avgMetrics(prevRows);
  const teamLatestFinal = finalFromFive(teamLatest);
  const teamPreviousFinal = previous ? finalFromFive(teamPrevious) : null;

  return {
    latest,
    previous,
    people,
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
