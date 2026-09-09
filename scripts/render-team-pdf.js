// Renders a one-table CTO report from data/store.json.
// Usage: node scripts/render-team-pdf.js [outFile]
import { inflateSync, inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvaluation, FIVE_METRICS } from '../src/lib.js';
import { buildTeamPdf } from '../src/pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STORE_PATH = path.join(ROOT, 'data', 'store.json');
const DEFAULT_OUT = path.join(ROOT, 'data', 'GATE-team-progress.pdf');

const W = {
  impact: 0.3,
  execution: 0.25,
  ownership: 0.2,
  collaboration: 0.15,
  growth: 0.1,
};

const ROLE_LABELS = {
  backend: 'Backend',
  frontend: 'Frontend',
  devops: 'DevOps',
  devnet: 'DevNet',
  service: 'Service',
  qa: 'QA',
};

function formulaFinal(metrics) {
  if (!metrics) return null;
  let sum = 0;
  let any = false;
  for (const [key, weight] of Object.entries(W)) {
    if (typeof metrics[key] === 'number' && Number.isFinite(metrics[key])) {
      sum += metrics[key] * weight;
      any = true;
    }
  }
  return any ? Math.round(sum * 1000) / 1000 : null;
}

function fiveFrom(a) {
  const src = a.archived && a.archive ? a.archive : a.metrics;
  if (!src || typeof src !== 'object') return null;
  const metrics = {
    impact: typeof src.impact === 'number' ? src.impact : null,
    execution: typeof src.execution === 'number' ? src.execution : null,
    ownership: typeof src.ownership === 'number' ? src.ownership : null,
    collaboration: typeof src.collaboration === 'number' ? src.collaboration : null,
    growth: typeof src.growth === 'number' ? src.growth : null,
  };
  return Object.values(metrics).some((v) => v != null) ? metrics : null;
}

function fromStore(a) {
  return {
    name: a.name,
    username: a.username || null,
    period: a.period,
    roleSlug: a.roleSlug,
    level: a.level,
    metrics: fiveFrom(a),
    archive: a.archive || null,
    notes: a.notes || '',
    evidence: a.evidence || '',
    finalScore: typeof a.finalScore === 'number' ? a.finalScore : null,
  };
}

function fmtNum(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Math.round(Number(value) * 1000) / 1000;
  return Number.isInteger(n) ? String(n) : String(n);
}

function signed(value) {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const n = Math.round(Number(value) * 1000) / 1000;
  if (Math.abs(n) < 0.0005) return '0.000';
  return `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(3)}`;
}

function pdfStrings(buf) {
  const latin = buf.toString('latin1');
  const out = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = re.exec(latin))) {
    let payload = Buffer.from(match[1], 'latin1');
    if (payload[0] === 0x0d && payload[1] === 0x0a) payload = payload.subarray(2);
    else if (payload[0] === 0x0a || payload[0] === 0x0d) payload = payload.subarray(1);
    let decoded = payload;
    try {
      decoded = inflateSync(payload);
    } catch {
      try {
        decoded = inflateRawSync(payload);
      } catch {
        decoded = payload;
      }
    }
    const body = decoded.toString('latin1');
    const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
    let t;
    while ((t = tj.exec(body))) {
      const raw = t[0].slice(1, t[0].lastIndexOf(')'));
      out.push(raw.replace(/\\n/g, '\n').replace(/\\([()\\])/g, '$1'));
    }
  }
  return out;
}

function nearbyHas(strings, name, needle) {
  const idx = strings.findIndex((s) => s === name || s.startsWith(name));
  if (idx < 0) return false;
  const window = strings.slice(Math.max(0, idx - 5), idx + 20).join('\n');
  return window.includes(needle);
}

const store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
const assessments = store.assessments || [];
const records = assessments.map(fromStore);
const evaln = buildEvaluation(records);
evaln.generated = new Date().toISOString().slice(0, 10);

const q1 = assessments.filter((a) => a.archived && String(a.period).trim() === 'Q1 1405');
const q2 = assessments.filter((a) => !a.archived && String(a.period).trim() === 'Q2 1405');

const expectedQ1 = {
  'ali.dehghan': { impact: 4, execution: 3, ownership: 5, collaboration: 4, growth: 4, final: 3.95, level: 3 },
  'a.ghasemi': { impact: 3.5, execution: 4.5, ownership: 4, collaboration: 4, growth: 4, final: 3.975, level: 3 },
  'a.pahlavanian': { impact: 4, execution: 4, ownership: 4.75, collaboration: 3.75, growth: 5, final: 4.213, level: 3 },
  'hosseini.motlagh': { impact: 4, execution: 3.5, ownership: 4.5, collaboration: 4, growth: 4, final: 3.975, level: 2 },
  'f.ahmadi': { impact: 4, execution: 3.75, ownership: 3.75, collaboration: 3.5, growth: 3.75, final: 3.788, level: 3 },
  'm.noeiaval': { impact: 4, execution: 3.5, ownership: 4.25, collaboration: 3.5, growth: 3.75, final: 3.825, level: 4 },
  'hamed.dehghan': { impact: 3, execution: 3, ownership: 3.5, collaboration: 3, growth: 3, final: 3.1, level: 3 },
};

const out = path.resolve(process.argv[2] || DEFAULT_OUT);
const doc = buildTeamPdf(evaln);
const bytes = Buffer.from(doc.output('arraybuffer'));
writeFileSync(out, bytes);

const strings = pdfStrings(bytes);
const blob = strings.join('\n');
const failures = [];

function must(ok, message) {
  if (!ok) failures.push(message);
}

must(q1.length === 7, `expected 7 Q1 archives, got ${q1.length}`);
must(q2.length === 7, `expected 7 Q2 assessments, got ${q2.length}`);
must(blob.includes('scale 1-7') || blob.includes('Scale 1-7') || blob.includes('1-7'), 'PDF must label the 1-7 scale');
must(blob.includes('0.30 Impact') && blob.includes('0.25 Execution'), 'PDF must include the formula');
must(!blob.includes('3.038'), 'Fatemeh spreadsheet final 3.038 must not appear');
must(!blob.split('\n').includes('4.1'), 'Laya spreadsheet final 4.1 must not appear as a score');
must(
  /Vazirmatn/i.test(bytes.toString('latin1')),
  'PDF must embed Vazirmatn for Persian evidence',
);
must(!/did not come from Excel/i.test(blob), 'PDF must not mention Excel origin');
must(!/no original scores|had no scores|completed for this report/i.test(blob), 'PDF must not call out missing original scores');
must(!/proposed Q2|proposed review|not a locked/i.test(blob), 'PDF must not include proposed-Q2 disclaimer copy');
must(doc.getNumberOfPages() === 2, `PDF should be two pages, got ${doc.getNumberOfPages()}`);

for (const a of q1) {
  const expect = expectedQ1[a.username];
  if (!expect) {
    failures.push(`unexpected Q1 username ${a.username}`);
    continue;
  }
  const metrics = fiveFrom(a);
  const final = formulaFinal(metrics);
  for (const m of FIVE_METRICS) {
    must(metrics?.[m.key] === expect[m.key], `${a.name} Q1 ${m.key}: store ${metrics?.[m.key]} != ${expect[m.key]}`);
  }
  must(final === expect.final, `${a.name} Q1 final ${final} != ${expect.final}`);
  must(a.archive.computedFinal === expect.final, `${a.name} archive.computedFinal ${a.archive.computedFinal} != ${expect.final}`);
  must(a.level === expect.level, `${a.name}: Q1 level ${a.level} != ${expect.level}`);
}

const rows = [];
for (const person of evaln.people) {
  const q1Row = q1.find((a) => a.username === person.username || a.name === person.name);
  const q2Row = q2.find((a) => a.username === person.username || a.name === person.name);
  const q1Metrics = q1Row ? fiveFrom(q1Row) : null;
  const q2Metrics = q2Row ? fiveFrom(q2Row) : null;
  const q1Final = formulaFinal(q1Metrics);
  const q2Final = formulaFinal(q2Metrics);
  const delta = q1Final != null && q2Final != null ? Math.round((q2Final - q1Final) * 1000) / 1000 : null;
  const q1Text = q1Final == null ? '-' : fmtNum(q1Final);
  const q2Text = q2Final == null ? '-' : fmtNum(q2Final);
  const deltaText = signed(delta);

  must(q1Text !== '-', `${person.name}: Q1 must show a number, not a dash`);
  must(q2Text !== '-', `${person.name}: Q2 must show a number, not a dash`);
  must(deltaText !== '-', `${person.name}: improvement must show a number, not a dash`);
  must(Boolean(q2Row?.evidence || q2Row?.notes), `${person.name}: Q2 evidence/notes missing`);

  const nameInPdf = strings.some((s) => s.includes(person.name));
  const q1InPdf = nearbyHas(strings, person.name, q1Text);
  const q2InPdf = nearbyHas(strings, person.name, q2Text);
  const deltaInPdf = nearbyHas(strings, person.name, deltaText);
  const levelInPdf = nearbyHas(strings, person.name, person.level ? `L${person.level}` : '-');

  must(nameInPdf, `${person.name}: name missing from PDF`);
  must(q1InPdf, `${person.name}: Q1 ${q1Text} missing near name`);
  must(q2InPdf, `${person.name}: Q2 ${q2Text} missing near name`);
  must(deltaInPdf, `${person.name}: improvement ${deltaText} missing near name`);
  must(levelInPdf, `${person.name}: L${person.level} missing near name`);
  must(person.previousFinal === q1Final, `${person.name}: eval Q1 ${person.previousFinal} != archive ${q1Final}`);
  must(person.latestFinal === q2Final, `${person.name}: eval Q2 ${person.latestFinal} != store ${q2Final}`);

  rows.push({
    name: person.name,
    role: ROLE_LABELS[person.roleSlug] || person.roleSlug,
    level: `L${person.level}`,
    q1: q1Text,
    q2: q2Text,
    improvement: deltaText,
    pdf: nameInPdf && q1InPdf && q2InPdf && deltaInPdf ? 'MATCH' : 'MISMATCH',
  });
}

console.log(`store: ${STORE_PATH}`);
console.log(`assessments: ${assessments.length} | periods: ${[...new Set(assessments.map((a) => a.period))].join(', ')}`);
console.log(`wrote ${out} (${bytes.length} bytes, ${doc.getNumberOfPages()} page)`);
console.log('');
console.log('Q1 1405 vs Q2 1405 (store archives vs PDF):');
console.log(
  'Name'.padEnd(24)
  + 'Role'.padEnd(10)
  + 'Lvl'.padEnd(5)
  + 'Q1 Final'.padEnd(12)
  + 'Q2 Final'.padEnd(12)
  + 'Improvement'.padEnd(14)
  + 'PDF',
);
for (const r of rows) {
  console.log(
    String(r.name).padEnd(24)
    + String(r.role).padEnd(10)
    + String(r.level).padEnd(5)
    + String(r.q1).padEnd(12)
    + String(r.q2).padEnd(12)
    + String(r.improvement).padEnd(14)
    + r.pdf,
  );
}

must(!blob.includes('-0.100') && !blob.includes('-.100'), 'Fatemeh improvement must not be negative');
must(nearbyHas(strings, 'Fatemeh Ahmadi', '+0.062') || nearbyHas(strings, 'Fatemeh Ahmadi', '+.062'), 'Fatemeh improvement +0.062 must appear');
must(!/GATE-\d+/i.test(blob), 'PDF must not cite GATE ticket IDs');
const bannedTasks = [
  'OpenSSH',
  'WAF',
  'Convertor',
  'convertor',
  'Snort',
  'OpenVPN',
  'UI library',
  'Zabbix',
  'vCenter',
  'Wireshark',
  'IPsec',
  'libdaq',
  'Design System',
  'Customer Management',
  'Cursor',
];
for (const word of bannedTasks) {
  must(!blob.includes(word), `PDF must not name product/task "${word}"`);
}
must(!/Spec standing/i.test(blob), 'page 2 must not include extra Spec standing copy');
must(!/narrowed one band|did not widen|still the lag/i.test(blob), 'page 2 must not keep Ahmadi negative copy');
must(blob.includes('Metric evidence'), 'page 2 must lead with Metric evidence');
must(blob.includes('Impact'), 'page 2 must use Impact as a metric name');
must(blob.includes('Scope of impact'), 'page 2 must keep Latin spec names as the main terms');
must(blob.includes('Review depth') || blob.includes('Change failure rate'), 'page 2 must keep Latin spec titles');
must(blob.includes('Incident response'), 'Mohsen page 2 must use Incident response');
must(blob.includes('Business and product outcome'), 'page 2 must include Impact outcome for DevOps/Mohsen');
must(!blob.includes('Delivery predictability'), 'page 2 must not repeat Delivery predictability');
must(q2.every((a) => a.metrics && typeof a.finalScore === 'number'), 'all Q2 rows must have numeric metrics');

let page2Text = '';
try {
  page2Text = execFileSync('pdftotext', ['-f', '2', '-l', '2', '-layout', '-enc', 'UTF-8', out, '-'], {
    encoding: 'utf8',
  });
} catch (err) {
  page2Text = String(err.stdout || '');
  if (!/Identity-H/i.test(String(err.message || err.stderr || ''))) {
    failures.push(`pdftotext failed: ${err.message}`);
  }
}
must(!/GATE-\d+/i.test(page2Text), 'pdftotext page 2 still has GATE ticket IDs');
for (const word of bannedTasks) {
  must(!page2Text.includes(word), `pdftotext page 2 still names "${word}"`);
}
must(
  /Impact|Execution|Ownership|Collaboration|Growth/.test(page2Text),
  'pdftotext page 2 must show Latin metric names',
);
must(
  /Review depth|Change failure rate|Incident response|Written communication/.test(page2Text),
  'pdftotext page 2 must show role-specific Latin spec titles',
);
must(
  !/Delivery predictability/.test(page2Text),
  'pdftotext page 2 must not repeat Delivery predictability',
);

const pngOut = '/tmp/gate-team-progress-page2';
try {
  execFileSync('pdftocairo', ['-png', '-f', '2', '-l', '2', '-r', '140', out, pngOut], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  const stderr = String(err.stderr || '');
  if (!/Identity-H/i.test(stderr) && err.status) {
    failures.push(`pdftocairo failed: ${err.message}`);
  }
}
const pngPath = `${pngOut}-2.png`;
try {
  const png = readFileSync(pngPath);
  must(png.length > 40000, `page 2 PNG too small (${png.length} bytes) — Persian outlines missing?`);
  must(png[0] === 0x89 && png[1] === 0x50, 'page 2 raster is not a PNG');
} catch (err) {
  failures.push(`page 2 PNG missing after pdftocairo: ${err.message}`);
}

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log('\nAll Q1 archive values match the PDF. Three-phrase evidence page present.');
if (page2Text) {
  console.log('\nPage 2 (pdftotext):\n');
  console.log(page2Text.trim());
}
