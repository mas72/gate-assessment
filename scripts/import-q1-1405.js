import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, '..', 'data', 'store.json');

const AGILE = ['sprint-reliability', 'flow', 'blockers', 'dod', 'process', 'breakdown', 'estimation'];
const SOFT_COLLAB = ['communication', 'collaboration', 'feedback', 'mentoring', 'stakeholders'];
const SOFT_OWN = ['ownership', 'pressure'];
const DELIVERY = ['predictable', 'release-quality', 'incidents'];
const GROWTH = ['learning', 'sharing', 'self-direction', 'career'];

const ROLE_TECH = {
  backend: ['be-testing', 'be-code', 'be-data', 'be-design', 'be-prod', 'be-debug'],
  frontend: ['fe-ui', 'fe-state', 'fe-a11y', 'fe-test', 'fe-perf', 'fe-debug'],
  devops: ['do-cicd', 'do-release', 'do-obs', 'do-env', 'do-sec', 'do-ops'],
  devnet: ['dn-auto', 'dn-api', 'dn-policy', 'dn-net', 'dn-tooling', 'dn-debug'],
  service: ['sv-deploy', 'sv-trouble', 'sv-config', 'sv-customer', 'sv-escalation', 'sv-ops'],
  qa: ['qa-design', 'qa-release', 'qa-defects', 'qa-negative', 'qa-auto', 'qa-risk'],
};

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

// Spreadsheet values are stored as entered. The UI scale is 1-7 so a future
// review can sit above 5; archived numbers are not stretched.

// Confirmed GATE levels for the team. The spreadsheet job titles are only a hint,
// so the level is pinned per person here instead of being derived from the title.
const LEVEL_BY_USERNAME = {
  'm.noeiaval': 4,
  'hosseini.motlagh': 2,
};

function levelFor(username) {
  return LEVEL_BY_USERNAME[username] ?? 3;
}

function mapScores(roleSlug, row) {
  const scores = {};
  const setAll = (ids, value) => {
    if (value == null) return;
    for (const id of ids) scores[id] = value;
  };
  setAll(ROLE_TECH[roleSlug] || [], row.impact);
  setAll(AGILE, row.execution);
  setAll(DELIVERY, row.execution);
  setAll(SOFT_COLLAB, row.collaboration);
  setAll(SOFT_OWN, row.ownership);
  setAll(GROWTH, row.growth);
  return scores;
}

function computedFinal(row) {
  const parts = [
    [row.impact, 0.3],
    [row.execution, 0.25],
    [row.ownership, 0.2],
    [row.collaboration, 0.15],
    [row.growth, 0.1],
  ];
  if (parts.some(([v]) => v == null)) return null;
  return Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) * 1000) / 1000;
}

const ROWS = [
  {
    username: 'ali.dehghan',
    name: 'Alireza Dehghan',
    roleSlug: 'backend',
    jobLevel: 'Mid-Level',
    impact: 4,
    execution: 3,
    ownership: 5,
    collaboration: 4,
    growth: 4,
    excelFinal: 3.95,
    band: 'Average',
    bonus: 0.1,
  },
  {
    username: 'a.ghasemi',
    name: 'Ali Ghasemi',
    roleSlug: 'devops',
    jobLevel: 'Mid-Level',
    impact: 3.5,
    execution: 4.5,
    ownership: 4,
    collaboration: 4,
    growth: 4,
    excelFinal: 3.975,
    band: 'Strong',
    bonus: 0.2,
  },
  {
    username: 'a.pahlavanian',
    name: 'Abolfazl Pahlavanian',
    roleSlug: 'devnet',
    jobLevel: 'Mid-Level',
    impact: 4,
    execution: 4,
    ownership: 4.75,
    collaboration: 3.75,
    growth: 5,
    excelFinal: 4.213,
    band: 'Strong',
    bonus: 0.2,
  },
  {
    username: 'hosseini.motlagh',
    name: 'Laya Hosseini Motlagh',
    roleSlug: 'qa',
    jobLevel: 'Junior',
    impact: 4,
    execution: 3.5,
    ownership: 4.5,
    collaboration: 4,
    growth: 4,
    excelFinal: 4.1,
    band: 'Strong',
    bonus: 0.2,
  },
  {
    username: 'f.ahmadi',
    name: 'Fatemeh Ahmadi',
    roleSlug: 'service',
    jobLevel: 'Mid-Level',
    impact: 4,
    execution: 3.75,
    ownership: 3.75,
    collaboration: 3.5,
    growth: 3.75,
    excelFinal: 3.038,
    band: 'Average',
    bonus: 0.1,
  },
  {
    username: 'm.noeiaval',
    name: 'Mohsen Noeiaval',
    roleSlug: 'service',
    jobLevel: 'Senior',
    impact: 4,
    execution: 3.5,
    ownership: 4.25,
    collaboration: 3.5,
    growth: 3.75,
    excelFinal: null,
    band: 'Strong',
    bonus: 0,
    incomplete: false,
    completedForReport: true,
  },
  {
    username: 'hamed.dehghan',
    name: 'Hamed Dehghan',
    roleSlug: 'frontend',
    jobLevel: 'Mid-Level',
    impact: 3,
    execution: 3,
    ownership: 3.5,
    collaboration: 3,
    growth: 3,
    excelFinal: null,
    band: 'Average',
    bonus: 0,
    incomplete: false,
    completedForReport: true,
  },
];

const store = JSON.parse(fs.readFileSync(STORE, 'utf8'));
store.assessments = store.assessments || [];
store.assessments = store.assessments.filter((a) => a.source !== 'q1-1405-xlsx');
store.nextAssessmentId = Math.max(1, ...store.assessments.map((a) => a.id), 0) + 1;

const now = new Date().toISOString();
const created = [];

for (const row of ROWS) {
  const impact = num(row.impact);
  const execution = num(row.execution);
  const ownership = num(row.ownership);
  const collaboration = num(row.collaboration);
  const growth = num(row.growth);
  const computed = computedFinal({ impact, execution, ownership, collaboration, growth });
  const notes = [
    'Archived from advanced_team_evaluation.xlsx as Q1 1405.',
    'Original scheme: Impact 30% (product output), Execution 25% (quality of work), Ownership 20% (independence), Collaboration 15% (teamwork), Growth 10% (personal growth).',
    `Job level in spreadsheet: ${row.jobLevel}. Recorded GATE level: L${levelFor(row.username)}.`,
    row.completedForReport
      ? `Q1 five-metric scores were completed for the GATE team progress report because the original spreadsheet had no values. These Q1 figures did not come from Excel. Recomputed final ${computed}.`
      : computed != null
        ? `Spreadsheet final ${row.excelFinal} · recomputed from the five scores ${computed}.`
        : 'No numeric scores in the spreadsheet for this person.',
    row.bonus ? `Bonus recorded: ${Math.round(row.bonus * 100)}%.` : '',
    row.incomplete ? 'Incomplete in the original file — kept as an archive stub.' : '',
    row.name === 'Fatemeh Ahmadi'
      ? 'Note: the spreadsheet final (3.04) does not match 4×30% + 3.75×25% + 3.75×20% + 3.5×15% + 3.75×10% = 3.79. Both values are stored.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const assessment = {
    id: store.nextAssessmentId++,
    name: row.name,
    username: row.username,
    period: 'Q1 1405',
    roleSlug: row.roleSlug,
    level: levelFor(row.username),
    scores: mapScores(row.roleSlug, { impact, execution, ownership, collaboration, growth }),
    notes,
    promotion: {},
    archived: true,
    source: 'q1-1405-xlsx',
    archive: {
      file: 'data/archives/q1-1405-advanced_team_evaluation.xlsx',
      scheme: 'impact-execution-ownership-collaboration-growth',
      jobLevel: row.jobLevel,
      impact,
      execution,
      ownership,
      collaboration,
      growth,
      excelFinal: row.excelFinal == null ? null : num(row.excelFinal),
      computedFinal: computed,
      band: row.band,
      bonus: row.bonus,
      incomplete: Boolean(row.incomplete),
      importedAt: now,
      ...(row.completedForReport
        ? {
            completedForReport: true,
            completedForReportNote:
              'Q1 five-metric scores were completed for the GATE team progress report. The original spreadsheet had no numeric scores for this person.',
          }
        : {}),
    },
    createdBy: 'm.dehghan',
    createdAt: '2026-04-20T13:38:00.000Z',
    updatedAt: now,
  };
  store.assessments.push(assessment);
  created.push(`${assessment.name} · ${assessment.roleSlug} · L${assessment.level}${row.incomplete ? ' (incomplete)' : ''}`);
}

fs.writeFileSync(STORE, JSON.stringify(store, null, 2));
console.log(`Imported ${created.length} Q1 1405 archives`);
created.forEach((line) => console.log(' -', line));
